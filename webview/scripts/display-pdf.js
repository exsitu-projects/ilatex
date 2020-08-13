// Get a reference to PDF.js
const pdfjsLib = window["pdfjsLib"];

// Specify the URI to the required worker
// TODO: use a local URI
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";

// Get the pixel ratio of the user's device
const DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1.0;

// Unique reference to the current displayable PDF object
let currentDisplayablePdf = null;

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

function cloneVisualisationNodeFromSourceIndex(sourceIndex) {
    // The visualisation node should be cloned before it is processed/displayed
    // This enables other scripts to alter the node to be displayed
    // without taking precautions in case the original node has to be used again
    return visualisationsNode
        .querySelector(`.visualisation[data-source-index="${sourceIndex}"]`)
        .cloneNode(true);
}

function saveDocument() {
    vscode.postMessage({
        type: MessageTypes.SaveDocument
    });
}


class VisualisationPopup {
    constructor(sourceIndex, maskRect) {
        this.visualisationNode = cloneVisualisationNodeFromSourceIndex(sourceIndex);
        this.sourceIndex = sourceIndex;
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

        // Ref. to the event handler used for visualisations changes
        // (to be able to remove the handler when the popup is closed)
        this.visualisationsChangesHandler = async (event) => {
            this.onVisualisationsChanged(event);
        };

        this.startHandlingBackgroundClicks();
        this.startHandlingVisualisationsChanges();
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

    getLocationInCodeAsText() {
        const startLocation = parseLocationFromAttribute(this.visualisationNode.getAttribute("data-loc-start"));
        const endLocation = parseLocationFromAttribute(this.visualisationNode.getAttribute("data-loc-end"));
        return startLocation.lineIndex === endLocation.lineIndex
             ? `(line ${startLocation.lineIndex + 1})`
             : `(lines ${startLocation.lineIndex + 1}&#8198;–&#8198;${endLocation.lineIndex + 1})`;         
    }

    createTitleBar() {
        // Create an empty title bar
        this.titleBarNode = document.createElement("div");
        this.titleBarNode.classList.add("popup-title-bar");
        this.frameNode.append(this.titleBarNode);

        // Add the name and the location of the visualisation as a title
        const titleNode = document.createElement("span");
        titleNode.classList.add("title");
        this.titleBarNode.append(titleNode);
        
        // Add the name (of the visualised command/environement) to the title
        const nameNode = document.createElement("span");
        nameNode.classList.add("name");
        titleNode.append(nameNode);

        nameNode.textContent = this.visualisationNode.getAttribute("data-name");

        // Add the location (in the code) to the title
        const locationNode = document.createElement("span");
        locationNode.classList.add("location");
        titleNode.append(locationNode);

        locationNode.innerHTML = this.getLocationInCodeAsText();

        // Reveal the code of the visualisation when the title is clicked
        titleNode.addEventListener("click", event => {
            revealVisualisationCode(this.visualisationNode);
        });

        // Add a button to close the popup
        const closeButtonNode = document.createElement("button");
        closeButtonNode.classList.add("close-button");
        this.titleBarNode.append(closeButtonNode);

        // Close the popup and save the document on click
        closeButtonNode.addEventListener("click", event => {
            this.closeAndSaveDocument();
        });
    }

    // Must be called in case the visualisation is updated
    updateTitleBar() {
        this.titleBarNode.querySelector(".location").innerHTML = this.getLocationInCodeAsText();
    }

    createContent() {
        this.contentNode = document.createElement("div");
        this.contentNode.classList.add("popup-content");

        this.frameNode.append(this.contentNode);

        // Move the visualisation inside the popup
        this.contentNode.append(this.visualisationNode);   
    }

    // Must be called in case the visualisation is updated
    updateContent() {
        this.contentNode.innerHTML = "";
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

    async onVisualisationsChanged(event) {
        // Ignore the event if it does not originate from a request made by the visualisation
        if (!event.detail.requestedByVisualisation) {
            return;
        }

        // Update the vis. node and the elements of the popup which may depend on it
        this.visualisationNode = cloneVisualisationNodeFromSourceIndex(this.sourceIndex);
        this.updateTitleBar();
        this.updateContent();

        console.log("About to update the visualisation");
        console.log(this);

        // Emit an event to signal that the visible visualisation has just been updated
        pdfNode.dispatchEvent(new CustomEvent("visualisation-updated", {
            detail: {
                visualisationNode: this.visualisationNode
            }
        }));
    }

    startHandlingVisualisationsChanges() { 
        visualisationsNode.addEventListener("visualisations-changed", this.visualisationsChangesHandler);
        console.log("+ added the vis change handler", this.visualisationsChangesHandler);
    }

    stopHandlingVisualisationsChanges() {
        visualisationsNode.removeEventListener("visualisations-changed", this.visualisationsChangesHandler);
        console.log("– removed the vis change handler", this.visualisationsChangesHandler);
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
        this.stopHandlingVisualisationsChanges();

        // Emit an event to signal that a visualisation has just been hidden
        pdfNode.dispatchEvent(new CustomEvent("visualisation-hidden", {
            detail: {
                visualisationNode: this.visualisationNode
            }
        }));
    }

    closeAndSaveDocument() {
        this.close();

        // Tell the extension to save the document
        // (which will further trigger an update of the webview)
        saveDocument();
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

    removeAnnotationMasks() {
        for (let maskNode of this.visualisationAnnotationMaskNodes) {
            maskNode.remove();
        }

        this.visualisationAnnotationMaskNodes = [];
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
        new VisualisationPopup(sourceIndex, maskRect);
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

        // Current scale to display the PDF at
        this.scale = 1.0;
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

    createAllAnnotationMasks() {
        for (let displayablePage of this.displayablePages.values()) {
            displayablePage.createAnnotationMasks();
            this.annotationMaskContainerNode.append(
                ...displayablePage.visualisationAnnotationMaskNodes
            );
        }
    }

    removeAllAnnotationsMasks() {
        for (let displayablePage of this.displayablePages.values()) {
            displayablePage.removeAnnotationMasks();
        }

        this.annotationMaskContainerNode.innerHTML = "";
    }

    appendTo(node) {
        node.append(this.pageContainerNode);
        node.append(this.annotationMaskContainerNode);
    }

    redraw() {
        this.removeAllAnnotationsMasks();

        for (let displayablePage of this.displayablePages.values()) {
            displayablePage.computeViewport();
            displayablePage.resizeCanvas();
            displayablePage.draw();
        }

        // Create the (new) annotation masks
        // This can only be perforned once the canvas have been appended to the DOM
        // since their positions in the page is required to compute the absolute positions
        // of the masks (see the related methods in DisplayablePDFPage)
        this.createAllAnnotationMasks();
    }

    redrawInto(node) {
        this.appendTo(node);
        this.redraw();
    }

    static async fromURI(uri) {
        const maxNbAttempts = 8;
        let currentAttempt = 1;
        let displayablePdf = null;

        console.log("Start loading the PDF at: ", uri);
        while (!displayablePdf && currentAttempt <= maxNbAttempts) {
            console.log("Loading attempt " + currentAttempt);
            currentAttempt += 1;
            try {
                const pdf = await pdfjsLib.getDocument(uri).promise;
                displayablePdf = new DisplayablePDF(pdf);
            }
            catch (error) {
                // Ignore error and re-try
            }
        }
        
        // Only intialise the displayable PDF if it has been loaded
        if (displayablePdf) {
            await displayablePdf.init();
        }

        return displayablePdf;
    }
}

pdfNode.addEventListener("pdf-changed", async (event) => {
    // Create a new displayable PDF
    const newDisplayablePdf = await DisplayablePDF.fromURI(event.detail.pdfUri);
    console.log("New displayable PDF: ", newDisplayablePdf);

    // If it could be successfuly loaded, replace the old one by the new one
    if (newDisplayablePdf) {
        currentDisplayablePdf = newDisplayablePdf;

        pdfNode.innerHTML = "";
        newDisplayablePdf.redrawInto(pdfNode);
    }
});

pdfNode.addEventListener("pdf-resized", async (event) => {
    // If there is a PDF to display, trigger a full redraw
    if (currentDisplayablePdf) {
        currentDisplayablePdf.redraw();
    }
});