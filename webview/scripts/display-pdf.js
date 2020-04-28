// Get a reference to PDF.js
const pdfjsLib = window["pdfjsLib"];

// Specify the URI to the required worker
// TODO: use a local URI
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";

// Get the pixel ratio of the user's device
const DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1.0;

function findMaskNodeWithIndex(sourceIndex) {
    return pdfNode.querySelector(
        `.pdf-annotation-mask-container .annotation-mask[data-source-index="${sourceIndex}"]`
    );
}

function findPageNode(pageNumber) {
    return pdfNode.querySelector(
        `.pdf-page-container .pdf-page[data-page-number="${pageNumber}"]`
    );
}

function saveDocument() {
    vscode.postMessage({
        type: MessageTypes.SaveDocument
    });
}


// TODO: handle the update of visualisations while a popup is open?
class VisualisationPopup {
    constructor(visualisationNode, maskRect) {
        this.visualisationNode = visualisationNode;
        this.maskRect = maskRect;

        // Create the different components of the popup
        // The popup node is the root container of the popup in the DOM
        this.popupNode = document.createElement("div");
        this.popupNode.classList.add("visualisation-popup");

        this.backgroundNode = null;
        this.frameNode = null;
        this.titleBarNode = null;
        this.contentNode = null;

        this.createBackground();
        this.createFrame();
        this.createTitleBar();
        this.createContent();

        this.startHandlingBackgroundClicks();
        this.open();
    }

    createBackground() {
        this.backgroundNode = document.createElement("div");
        this.backgroundNode.classList.add("popup-background");

        this.popupNode.append(this.backgroundNode);
    }

    createFrame() {
        this.frameNode = document.createElement("div");
        this.frameNode.classList.add("popup-frame");

        this.popupNode.append(this.frameNode);
        
        // Position the frame at the given vertical offset
        const maskTop = this.maskRect[1];
        if (maskTop > window.scrollY + (window.innerHeight / 2)) {
            const maskTopToWebpageBottom = document.documentElement.clientHeight - maskTop;
            this.frameNode.style.bottom = `${maskTopToWebpageBottom + 20}px`;
        }
        else {
            const maskBottom = this.maskRect[3];
            this.frameNode.style.top = `${maskBottom + 20}px`;
        }
    }

    createTitleBar() {
        this.titleBarNode = document.createElement("div");
        this.titleBarNode.classList.add("popup-title-bar");
        this.frameNode.append(this.titleBarNode);

        // Add the name of the visualisation
        const name = this.visualisationNode.getAttribute("data-name");
        const nameNode = document.createElement("span");
        nameNode.classList.add("name");
        nameNode.textContent = name;

        this.titleBarNode.append(nameNode);

        // Add the location of the visualisation
        const startLocation = parseLocationFromAttribute(this.visualisationNode.getAttribute("data-loc-start"));
        const endLocation = parseLocationFromAttribute(this.visualisationNode.getAttribute("data-loc-end"));
        const locationNode = document.createElement("span");
        locationNode.classList.add("location");
        locationNode.innerHTML = startLocation.lineIndex === endLocation.lineIndex
                               ? `Line ${startLocation.lineIndex + 1}`
                               : `Lines ${startLocation.lineIndex + 1}&#8198;–&#8198;${endLocation.lineIndex + 1}`;

        // Select the code of the visualisation on click
        locationNode.addEventListener("click", event => {
            revealVisualisationCode(this.visualisationNode);
        });

        this.titleBarNode.append(locationNode);

        // Add a button to close the popup
        const closeButtonNode = document.createElement("button");
        closeButtonNode.classList.add("close-button");

        // Close the popup on click
        closeButtonNode.addEventListener("click", event => {
            this.close();
        });

        this.titleBarNode.append(closeButtonNode);
    }

    createContent() {
        this.contentNode = document.createElement("div");
        this.contentNode.classList.add("popup-content");

        this.frameNode.append(this.contentNode);

        // Move the visualisation inside the popup
        this.contentNode.append(this.visualisationNode);   
    }

    startHandlingBackgroundClicks() {
        this.backgroundNode.addEventListener("click", event => {
            if (event.target !== this.backgroundNode) {
                return;
            }
    
            this.close();
        });
    }

    open() {
        document.body.prepend(this.popupNode);

        // Emit an event to signal that a visualisation has just been displayed
        pdfNode.dispatchEvent(new CustomEvent("visualisation-displayed", {
            detail: {
                visualisationNode: this.visualisationNode
            }
        }));
    }

    close() {
        this.popupNode.remove();

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

    static fromSourceIndex(sourceIndex, maskRect) {
        // The visualisation node to be displayed is duplicated beforehand
        // This allows other scripts to alter the displayed visualisation nodes
        // without requiring a reset mechanism when the popup is closed
        console.log("looking for source index " + sourceIndex + " in ", visualisationsNode);
        const visualisationNode = visualisationsNode
            .querySelector(`.visualisation[data-source-index="${sourceIndex}"]`)
            .cloneNode(true);
        
        return new VisualisationPopup(visualisationNode, maskRect);
    }
}


class DisplayablePDFPage {
    constructor(page, pageNumber) {
        this.page = page;
        this.pageNumber = pageNumber;

        // Create a canvas for the page
        this.canvas = document.createElement("canvas");
        this.canvasContext = this.canvas.getContext("2d");

        // Structures for the page renderer
        this.transformMatrix = [DEVICE_PIXEL_RATIO, 0 , 0, DEVICE_PIXEL_RATIO, 0, 0];
        this.viewport = null;

        // PDF annotations
        this.annotations = [];
        this.visualisationAnnotations = [];

        // Masks for visualisation annotations (DOM nodes acting as masks to detect events,
        // positionned on top of the annotations, in absolute webpage coordinates)
        this.visualisationAnnotationMaskNodes = [];
    }

    async init() {
        await this.extractAnnotations();
        
        this.computeViewport();
        this.setCanvasAttributes();
        this.resizeCanvas();
        await this.draw();
    }

    setCanvasAttributes() {
        this.canvas.classList.add("pdf-page");
        this.canvas.setAttribute("data-page-number", this.pageNumber);

        // Note: the viewport must be computed before setting the following attributes
        this.canvas.setAttribute("data-viewport-width", this.viewport.width);
        this.canvas.setAttribute("data-viewport-height", this.viewport.height);
        this.canvas.setAttribute("data-viewport-scale", this.viewport.scale);
    }

    computeViewport() {
        // TODO: use the same scale for all pages? or display it somewhere?
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
            return annotation.annotationType === 20 // tooltip
                && annotation.alternativeText.startsWith("ilatex-visualisation");
        });
    }

    // Warning: this method requires the canvas to be appended in the DOM
    // to retrieve the correct absolute coordinates
    createAnnotationMasks() {
        for (let annotation of this.visualisationAnnotations) {
            // Extract the source index of the visualisation
            const [_, sourceIndexStr] = annotation.alternativeText.match(/[^\d]+(\d+)/);
            const sourceIndex = parseInt(sourceIndexStr);

            const maskNode = document.createElement("div");
            maskNode.classList.add("annotation-mask");
            maskNode.setAttribute("data-page-number", this.pageNumber);
            maskNode.setAttribute("data-source-index", sourceIndexStr);

            // Set the position and the size of the mask
            const maskRect = this.convertPdfRectToAbsoluteWebpageRect(annotation.rect);
            const [x1, y1, x2, y2] = maskRect;
            maskNode.style.top = `${y1}px`;
            maskNode.style.left = `${x1}px`;
            maskNode.style.width = `${x2 - x1}px`;
            maskNode.style.height = `${y2 - y1}px`;

            // Handle clicks on this mask
            maskNode.addEventListener("click", event => {
                DisplayablePDFPage.handleAnnotationMaskClick(annotation, sourceIndex, maskRect);
            });

            this.visualisationAnnotationMaskNodes.push(maskNode);
        }
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

    // convertPdfRectToCanvasRect(pdfRect) {
    //     // In addition to the transform matrix of the viewport,
    //     // the scaling must be further adapted to take the HDPI fix into account
    //     const viewportTransform = this.viewport.transform;
    //     const adaptX = x => DEVICE_PIXEL_RATIO * ((x * viewportTransform[0]) + viewportTransform[2]);
    //     const adaptY = y => DEVICE_PIXEL_RATIO * ((y * viewportTransform[3]) + viewportTransform[5]);
        
    //     // y1 and y2 must be swapped to change the origin from bottom-left to top-left 
    //     const [x1, y1, x2, y2] = pdfRect;
    //     return [adaptX(x1), adaptY(y2), adaptX(x2), adaptY(y1)];
    // }

    // Warning: this method requires the canvas to be appended in the DOM
    // to retrieve the correct absolute coordinates
    convertPdfRectToAbsoluteWebpageRect(pdfRect) {
        // Since the canvas element itself is not scaled up (only its content is),
        // the HDPI fix does not have to be taken into account here.
        // However, the current scroll of the page must be considered
        // since it affects the DOMRect returned by getBoudingClientRect().
        const canvasBox = this.canvas.getBoundingClientRect();
        const viewportTransform = this.viewport.transform;
        const adaptX = x => ((x * viewportTransform[0]) + viewportTransform[2])
                            + canvasBox.left
                            + window.scrollX;
        const adaptY = y => ((y * viewportTransform[3]) + viewportTransform[5])
                            + canvasBox.top 
                            + window.scrollY;
        
        // y1 and y2 must be swapped to change the origin from bottom-left to top-left 
        const [x1, y1, x2, y2] = pdfRect;
        return [adaptX(x1), adaptY(y2), adaptX(x2), adaptY(y1)];    
    }

    // drawAnnotationFrames(annotations) {
    //     this.canvasContext.save();
        
    //     this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    //     this.canvasContext.lineWidth = 3;
    //     this.canvasContext.strokeStyle = "#0074D9";

    //     for (let annotation of annotations) {
    //         let [x1, y1, x2, y2] = this.convertPdfRectToCanvasRect(annotation.rect);
    //         this.canvasContext.strokeRect(
    //             x1,
    //             y1,
    //             x2 - x1,
    //             y2 - y1
    //         );
    //     }
    
    //     this.canvasContext.restore();
    // }

    async draw() {
        await this.drawPage();
        // this.drawAnnotationFrames(this.annotations);
        // this.drawAnnotationFrames(this.visualisationAnnotations);
    }

    static handleAnnotationMaskClick(annotation, sourceIndex, maskRect) {
        VisualisationPopup.fromSourceIndex(sourceIndex, maskRect);
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

        // Create a container for the annotation masks
        this.annotationMaskContainerNode = document.createElement("div");
        this.annotationMaskContainerNode.classList.add("pdf-annotation-mask-container");

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
        // Display the pages first
        node.append(this.pageContainerNode);

        // Create and display the annotation masks second
        // This can only be perforned once the canvas have been appended to the DOM
        // since their positions in the page is required to compute the absolute positions
        // of the masks (see the related methods in DisplayablePDFPage)
        for (let displayablePage of this.displayablePages.values()) {
            displayablePage.createAnnotationMasks();
            this.annotationMaskContainerNode.append(
                ...displayablePage.visualisationAnnotationMaskNodes
            );
        }

        node.append(this.annotationMaskContainerNode);
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