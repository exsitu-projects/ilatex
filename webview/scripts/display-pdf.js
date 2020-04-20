// Get a reference to PDF.js
const pdfjsLib = window["pdfjsLib"];

// Specify the URI to the required worker
// TODO: use a local URI
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";

// Get the pixel ratio of the user's device
const DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1.0;

// Function to check if a mouse event occured inside a visualisation annotation
// It also expects a reference to the viewport of the page (to transform coordinates)
function isMousePointerInsideAnnotation(mouseEvent, annotation, viewport) {
    // TODO: better explain the role of the values taken fron the transform matrix
    // TODO: take the position of the canvas into account in case the page is scrolled?
    const mouseX = (window.scrollX + mouseEvent.clientX) / viewport.transform[0];
    const mouseY = ((window.scrollY + mouseEvent.clientY) - viewport.transform[5]) / viewport.transform[3];
    const [x1, y1, x2, y2] = annotation.rect;

    return mouseX >= x1
        && mouseX <= x2
        && mouseY >= y1
        && mouseY <= y2;
}

function saveDocument() {
    vscode.postMessage({
        type: MessageTypes.SaveDocument
    });
}


// TODO: handle the update of visualisations while a popup is open?
class VisualisationPopup {
    constructor(visualisationNode, yOffset) {
        this.visualisationNode = visualisationNode;
        this.yOffset = yOffset;

        this.maskNode = null;
        this.containerNode = null;

        this.createMask();
        this.createContainer();

        this.startHandlingMaskClicks();
        this.open();
    }

    createMask() {
        this.maskNode = document.createElement("div");
        this.maskNode.classList.add("visualisation-mask");
    }

    createContainer() {
        this.containerNode = document.createElement("div");
        this.containerNode.classList.add("visualisation-container");
        this.maskNode.append(this.containerNode);
        
        // TODO: better position the container
        this.containerNode.style.top = `${this.yOffset}px`;

        // Move the visualisation inside the popup
        this.containerNode.append(this.visualisationNode);   
    }

    startHandlingMaskClicks() {
        this.maskNode.addEventListener("click", event => {
            if (event.target !== this.maskNode) {
                return;
            }
    
            this.close();
        });
    }

    open() {
        document.body.prepend(this.maskNode);

        // Emit an event to signal that a visualisation has just been displayed
        pdfNode.dispatchEvent(new CustomEvent("visualisation-displayed", {
            detail: {
                visualisationNode: this.visualisationNode
            }
        }));
    }

    close() {
        this.maskNode.remove();

        // Tell the extension to save the document
        // (which will further trigger an update of the webview)
        saveDocument();

        // Emit an event to signal that a visualisation has just been hidden
        pdfNode.dispatchEvent(new CustomEvent("visualisation-hidden", {
            detail: {
                visualisationNode: this.visualisationNode
            }
        }));
    }

    static fromSourceIndex(sourceIndex, yOffset) {
        // The visualisation node to be displayed is duplicated beforehand
        // This allows other scripts to alter the displayed visualisation nodes
        // without requiring a reset mechanism when the popup is closed
        const visualisationNode = visualisationsNode
            .querySelector(`.visualisation[data-source-index="${sourceIndex}"]`)
            .cloneNode(true);
        
        return new VisualisationPopup(visualisationNode, yOffset);
    }
}


class DisplayablePDFPage {
    constructor(page, pageNumber) {
        this.page = page;
        this.pageNumber = pageNumber;

        // Create a canvas for the page
        this.canvas = document.createElement("canvas");
        this.canvas.classList.add("pdf-page");
        this.canvas.setAttribute("data-page-number", pageNumber.toString());
        
        this.canvasContext = this.canvas.getContext("2d");

        // Structures for the page renderer
        this.transformMatrix = [DEVICE_PIXEL_RATIO, 0 , 0, DEVICE_PIXEL_RATIO, 0, 0];
        this.viewport = null;

        // PDF annotations
        this.annotations = [];
        this.visualisationAnnotations = [];
    }

    async init() {
        await this.extractAnnotations();
        
        this.computeViewport();
        this.resizeCanvas();
        await this.draw();

        this.startHandlingCanvasClicks();
    }

    computeViewport() {
        const webviewWidth = document.body.clientWidth;
        const pageWidth = this.page.view[2];
        const scale = webviewWidth / pageWidth;

        this.viewport = this.page.getViewport({
            scale: scale
        });
    }

    async extractAnnotations() {
        this.annotations = await this.page.getAnnotations();
        this.visualisationAnnotations = this.annotations.filter(annotation => {
            return annotation.annotationType === 20; // tooltip
        });
        
    }

    resizeCanvas() {
        // Make the dimensions of the canvas match those of the page
        this.canvas.width = this.viewport.width * DEVICE_PIXEL_RATIO;
        this.canvas.height = this.viewport.height * DEVICE_PIXEL_RATIO;

        this.canvas.style.width = `${this.viewport.width}px`;
        this.canvas.style.height = `${this.viewport.height}px`;
    }

    async drawPage() {
        // Use the device pixel ratio and the transform property
        // to make the PDF look crisp on HDPI displays
        // (cf. https://github.com/mozilla/pdf.js/issues/10509#issuecomment-585062007)
        await this.page.render({
            canvasContext: this.canvasContext,
            viewport: this.viewport,
            transform: this.transformMatrix
        });
    }

    drawAnnotationFrames(annotations) {
        this.canvasContext.save();
        
        this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
        this.canvasContext.lineWidth = 3;
        this.canvasContext.strokeStyle = "#0074D9";

        // Define functions to adapt PDF coordinates to canvax coordinates
        // In addition to the transform matrix of the viewport,
        // the scaling must be further adapted to take the HDPI fix into account
        const viewportTransform = this.viewport.transform;
        const adaptX = x => DEVICE_PIXEL_RATIO * (x * viewportTransform[0]);
        const adaptY = y => DEVICE_PIXEL_RATIO * ((y * viewportTransform[3]) + viewportTransform[5]);
        function adaptRect([x1, y1, x2, y2]) {
            return [adaptX(x1), adaptY(y1), adaptX(x2), adaptY(y2)];
        }

        for (let annotation of annotations) {
            let [x1, y1, x2, y2] = adaptRect(annotation.rect);
            this.canvasContext.strokeRect(
                x1,
                y1,
                x2 - x1,
                y2 - y1
            );
        }
    
        this.canvasContext.restore();
    }

    drawVisualisationAnnotations() {
        this.drawAnnotationFrames(this.visualisationAnnotations);
    }

    async draw() {
        await this.drawPage();
        // this.drawAnnotationFrames(this.annotations);
        this.drawVisualisationAnnotations();

        console.log("The PDF page has been successfully rendered!");
    }

    startHandlingCanvasClicks() {
        this.canvas.addEventListener("click", event => {
            this.handleCanvasClick(event);
        }); 
    }

    handleCanvasClick(event) {
        for (let annotation of this.annotations) {
            if (isMousePointerInsideAnnotation(event, annotation, this.viewport)) {
                this.handleVisualisationAnnotationClick(annotation);
            }
        }
    }

    handleVisualisationAnnotationClick(annotation) {
        console.log("A vis. annotation has been clicked: ", annotation);

        const annotationText = annotation.alternativeText;
        if (annotationText.startsWith("ilatex-visualisation")) {
            // Extract the source index of the visualisation
            // This is required to fetch the right visualisation node
            const [_, sourceIndexStr] = annotationText.match(/[^\d]+(\d+)/);
            const sourceIndex = parseInt(sourceIndexStr);

            // Compute the vertical position of the visualisation
            // according to the position of the click
            const yOffset = this.canvas.getBoundingClientRect().top + annotation.rect[3];
    
            VisualisationPopup.fromSourceIndex(sourceIndex, yOffset);
        }
    }

    static async fromPDFDocument(pdf, pageNumber) {
        const page = await pdf.getPage(pageNumber);

        const displayablePage = new DisplayablePDFPage(page, pageNumber);
        await displayablePage.init();

        return displayablePage;
    }
}


class DisplayablePDF {
    constructor(pdf) {
        this.pdf = pdf;

        // Create a container for the canvases of the pages
        this.pageContainerNode = document.createElement("div");
        this.pageContainerNode.classList.add("pdf-page-container");

        this.nbPages = pdf.numPages;
        this.displayablePages = new Map();
    }

    async init() {
        await this.loadAllPages();
    }

    async loadPage(pageNumber) {
        const displayablePage = await DisplayablePDFPage.fromPDFDocument(this.pdf, pageNumber);
        this.displayablePages.set(pageNumber, displayablePage);
        this.pageContainerNode.append(displayablePage.canvas);
    }

    async loadAllPages() {
        if (this.nbPages === 0) {
            console.log("The PDF contains no pages: there is nothing to load.");
            return;
        }

        for (let pageNumber = 1; pageNumber <= this.nbPages; pageNumber++) {
            await this.loadPage(pageNumber);
        }
    }

    displayInside(node) {
        node.append(this.pageContainerNode);
    }

    static async fromURI(uri) {
        console.log("Start loading the PDF at: ", uri);
        const pdf = await pdfjsLib.getDocument(uri).promise;
        
        const displayablePdf = new DisplayablePDF(pdf);
        await displayablePdf.init();

        return displayablePdf;
    }
}

pdfNode.addEventListener("pdf-changed", async (event) => {
    // Create a new displayable PDF
    const newDisplayablePdf = await DisplayablePDF.fromURI(event.detail.pdfUri);
    console.log("New displayable PDF: ", newDisplayablePdf);

    // Once it is fully loaded, replace the old one by the new one
    pdfNode.innerHTML = "";
    newDisplayablePdf.displayInside(pdfNode);
});