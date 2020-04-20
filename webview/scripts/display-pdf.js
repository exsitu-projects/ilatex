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


// TODO: handle the update of visualisations while a popup is open
// In particular, do not reinject the old vis. into the pool of vis. when the popup is closed
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

        // Emit an event to signal that a visualisatiuon has just been displayed
        pdfNode.dispatchEvent(new CustomEvent("visualisation-displayed", {
            detail: {
                visualisationNode: this.visualisationNode
            }
        }));
    }

    close() {
        // visualisationsNode.append(this.visualisationNode);
        this.maskNode.remove();

        // Emit an event to signal that a visualisatiuon has just been hidden
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
        this.draw();

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

    drawPage() {
        // Use the device pixel ratio and the transform property
        // to make the PDF look crisp on HDPI displays
        // (cf. https://github.com/mozilla/pdf.js/issues/10509#issuecomment-585062007)
        this.page.render({
            canvasContext: this.canvasContext,
            viewport: this.viewport,
            transform: this.transformMatrix
        });
    }

    drawAnnotationFrames(annotations) {
        this.canvasContext.save();
        
        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeStyle = "#0074D9";
        
        for (let annotation of annotations) {
            const [x1, y1, x2, y2] = annotation.rect;
            this.canvasContext.strokeRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));
        }
    
        this.canvasContext.restore();
    }

    drawVisualisationAnnotations() {
        // this.drawAnnotationFrames(this.annotations);
        this.drawAnnotationFrames(this.visualisationAnnotations);
    }

    draw() {
        this.drawPage();
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
        //this.nbLoadedPages = 0;
        this.displayablePages = new Map();
    }

    async init() {
        await this.loadAllPages();
    }

    async loadPage(pageNumber) {
        const displayablePage = await DisplayablePDFPage.fromPDFDocument(this.pdf, pageNumber);
        this.displayablePages.set(pageNumber, displayablePage);
        this.pageContainerNode.append(displayablePage.canvas);

        //this.nbLoadedPages += 1;
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
        console.log("The PDF has been displayed inside: ", node);
    }

    static async fromURI(uri) {
        console.log("Start loading the PDF at: ", uri);
        const pdf = await pdfjsLib.getDocument(uri).promise;
        
        const displayablePdf = new DisplayablePDF(pdf);
        await displayablePdf.init();

        return displayablePdf;
    }
}

// Get the PDF viewer node
// If it does not exist (i.e. no PDF file was found), skip the rest of the script
// const pdfViewerNode = document.querySelector("#pdf-viewer");

// // Add a canvas to the DOM (to display pages from the PDF afterwards)
// const canvas = document.createElement("canvas");
// const canvasContext = canvas.getContext("2d");
// pdfNode.append(canvas);

// function loadPDFDocument() {
//     if (pdfViewerNode) {
//         // Specify the URI to the required worker
//         const workerUri = pdfViewerNode.getAttribute("data-pdfjs-worker-uri");
//         pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";

//         const pdfUri = pdfViewerNode.getAttribute("data-pdf-uri");
        
//         console.log("Start loading the PDF...");
//         pdfjsLib
//             .getDocument(pdfUri)
//             .promise
//             .then(onPDFDocumentLoaded);
//     }
// }

// Map from page numbers to pages
// const pages = new Map();

// Function to call once the PDF document is loaded
// async function onPDFDocumentLoaded(pdf) {
//     if (pdf.numPages === 0) {
//         console.log("The PDF contains no pages: it cannot be displayed.");
//         return;
//     }

//     // Load the first page
//     // TODO: handle more pages/page change
//     const page = await getPDFPage(pdf, 1);

//     console.log("First page loaded: ", page);
//     onPDFPageLoaded(pdf, page);
// }


// Function to get a page from the PDF
// Either retrieve if (if it has previously been loaded) or load it
// async function getPDFPage(pdf, pageNumber) {
//     if (pages.has(pageNumber)) {
//         return pages.get(pageNumber);
//     }

//     const page = await pdf.getPage(pageNumber);
//     pages.set(pageNumber, page);

//     return page;
// }


// Function to call when a page is loaded
// async function onPDFPageLoaded(pdf, page) {
//     const viewport = displayPDFPage(page);

    // Log/draw all annotations (for debugging purposes)
    // const allAnnotations = await page.getAnnotations();
    // console.log("All annotations:", allAnnotations);
    // // drawAnnotationFrames(allAnnotations);

    // const annotations = await getVisualisableContentAnnotations(page);
    // drawAnnotationFrames(annotations);
    
    // startHandlingCanvasMouseMoves(annotations, viewport);
//     startHandlingCanvasClicks(annotations, viewport);
// }


// Function to display a page from the PDF
// function displayPDFPage(page) {
//     // Scale the page so it horizontally fits in the webview
//     const webviewWidth = document.body.clientWidth;
//     const pageWidth = page.view[2];
//     const scale = webviewWidth / pageWidth;

//     const viewport = page.getViewport({ scale: scale });

//     // Make the dimensions of the canvas match those of the page
//     // Use the device pixel ratio and the transform property to make the PDF crisp on HDPI displays
//     // (from https://github.com/mozilla/pdf.js/issues/10509#issuecomment-585062007)
//     const DEVICE_PIXEL_RATIO = window.DEVICE_PIXEL_RATIO || 1;
//     const transform = [DEVICE_PIXEL_RATIO, 0 , 0, DEVICE_PIXEL_RATIO, 0, 0];
    
//     canvas.width = viewport.width * DEVICE_PIXEL_RATIO;
//     canvas.height = viewport.height * DEVICE_PIXEL_RATIO;

//     canvas.style.width = `${viewport.width}px`;
//     canvas.style.height = `${viewport.height}px`;
    
//     page.render({
//         canvasContext: canvasContext,
//         viewport: viewport,
//         transform: transform
//     });

//     console.log("The PDF page has been successfully rendered!");
//     return viewport;
// }


// Function to compute the list of visualisable content annotations
// A visualisable content annotation is a special annotation of a part of the content of the PDF
// which is associated to an interactive visualisation (which can be displayed/edited)
// async function getVisualisableContentAnnotations(page) {
//     const annotations = await page.getAnnotations();

//     // Only keep "widget" annotations (created as tooltips using pdfcomment package)
//     return annotations.filter(annotation => {
//         return annotation.annotationType === 20; // tooltip
//     });
// }


// Function to draw a rectangle around the given annotations
// function drawAnnotationFrames(annotations) {
//     canvasContext.save();
//     canvasContext.lineWidth = 2;
//     canvasContext.strokeStyle = "#0074D9";
    
//     for (let annotation of annotations) {
//         const [x1, y1, x2, y2] = annotation.rect;
//         canvasContext.strokeRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));
//     }

//     canvasContext.restore();
// }





// Function to listen to and process clicks on the canvas
// It assumes all given annotations to be visualisable content annotations
// function startHandlingCanvasClicks(annotations, viewport) {
//     canvas.addEventListener("click", event => {
//         for (let annotation of annotations) {
//             if (isMousePointerInsideAnnotation(event, annotation, viewport)) {
//                 onAnnotationClick(event, annotation);
//             }
//         }
//     }); 
// }


// Function to process a click on an annotation
// It assumes the given annotation to be visualisable content annotation
// function onAnnotationClick(event, annotation) {
//     console.log("An annotation is clicked: ", annotation);

//     const annotationText = annotation.alternativeText;
//     if (annotationText.startsWith("ilatex-visualisation")) {
//         const [_, sourceIndexStr] = annotationText.match(/[^\d]+(\d+)/);
//         const sourceIndex = parseInt(sourceIndexStr);
//         const yOffset = canvas.getBoundingClientRect().top + annotation.rect[3];

//         displayVisualisationAtIndex(sourceIndex, yOffset);
//     }
// }


// Function to listen to and process mouse moves on the canvas
// It assumes all given annotations to be visualisable content annotations
// function startHandlingCanvasMouseMoves(annotations, viewport) {
//     canvas.addEventListener("mousemove", event => {
//         for (let annotation of annotations) {
//             if (isMousePointerInsideAnnotation(event, annotation, viewport)) {
//                 onAnnotationHovering(event, annotation);
//             }
//         }
//     }); 
// }


// // Function to process a click on an annotation
// // It assumes the given annotation to be visualisable content annotation
// function onAnnotationHovering(event, annotation) {
//     drawAnnotationFrames([annotation]);
// }

// function displayVisualisationAtIndex(sourceIndex, yOffset) {
//     const maskNode = document.createElement("div");
//     maskNode.classList.add("visualisation-mask");
//     document.body.prepend(maskNode);

//     const containerNode = document.createElement("div");
//     containerNode.classList.add("visualisation-container");
//     containerNode.style.top = `${yOffset}px`;
//     maskNode.append(containerNode);

//     const visualisationNode = document.querySelector(`.visualisation[data-source-index="${sourceIndex}"]`);
//     containerNode.append(visualisationNode);
//     console.log("Source index matches node: ", visualisationNode);

//     maskNode.addEventListener("click", event => {
//         if (event.target !== maskNode) {
//             return;
//         }

//         document.body.append(visualisationNode);
//         maskNode.remove();
//     });
// }

// Start loading the PDF document
// loadPDFDocument();


// Setup image frame objects for includegraphics visualisations
function createImageFrames() {
    const includegraphicsVisElements = visualisationsNode.querySelectorAll(`.visualisation[data-name="includegraphics"]`);
    for (let element of includegraphicsVisElements) {
        new ImageFrame(element);
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