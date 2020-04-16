// Get a reference to PDF.js
const pdfjsLib = window["pdfjsLib"];

// Get the PDF viewer node
// If it does not exist (i.e. no PDF file was found), skip the rest of the script
const pdfViewerNode = document.querySelector("#pdf-viewer");

// Add a canvas to the DOM (to display pages from the PDF afterwards)
const canvas = document.createElement("canvas");
const canvasContext = canvas.getContext("2d");
pdfViewerNode.append(canvas);

function loadPDFDocument() {
    if (pdfViewerNode) {
        // Specify the URI to the required worker
        const workerUri = pdfViewerNode.getAttribute("data-pdfjs-worker-uri");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";

        const pdfUri = pdfViewerNode.getAttribute("data-pdf-uri");
        
        console.log("Start loading the PDF...");
        pdfjsLib
            .getDocument(pdfUri)
            .promise
            .then(onPDFDocumentLoaded);
    }
}

// Map from page numbers to pages
const pages = new Map();

// Function to call once the PDF document is loaded
async function onPDFDocumentLoaded(pdf) {
    if (pdf.numPages === 0) {
        console.log("The PDF contains no pages: it cannot be displayed.");
        return;
    }

    // Load the first page
    // TODO: handle more pages/page change
    const page = await getPDFPage(pdf, 1);

    console.log("First page loaded: ", page);
    onPDFPageLoaded(pdf, page);
}


// Function to get a page from the PDF
// Either retrieve if (if it has previously been loaded) or load it
async function getPDFPage(pdf, pageNumber) {
    if (pages.has(pageNumber)) {
        return pages.get(pageNumber);
    }

    const page = await pdf.getPage(pageNumber);
    pages.set(pageNumber, page);

    return page;
}


// Function to call when a page is loaded
async function onPDFPageLoaded(pdf, page) {
    const viewport = displayPDFPage(page);

    // Log/draw all annotations (for debugging purposes)
    const allAnnotations = await page.getAnnotations();
    console.log("All annotations:", allAnnotations);
    // drawAnnotationFrames(allAnnotations);

    const annotations = await getVisualisableContentAnnotations(page);
    drawAnnotationFrames(annotations);
    
    // startHandlingCanvasMouseMoves(annotations, viewport);
    startHandlingCanvasClicks(annotations, viewport);
}


// Function to display a page from the PDF
function displayPDFPage(page) {
    // Scale the page so it horizontally fits in the webview
    const webviewWidth = document.body.clientWidth;
    const pageWidth = page.view[2];
    const scale = webviewWidth / pageWidth;

    const viewport = page.getViewport({ scale: scale });

    // Make the dimensions of the canvas match those of the page
    // Use the device pixel ratio and the transform property to make the PDF crisp on HDPI displays
    // (from https://github.com/mozilla/pdf.js/issues/10509#issuecomment-585062007)
    const devicePixelRatio = window.devicePixelRatio || 1;
    const transform = [devicePixelRatio, 0 , 0, devicePixelRatio, 0, 0];
    
    canvas.width = viewport.width * devicePixelRatio;
    canvas.height = viewport.height * devicePixelRatio;

    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    
    page.render({
        canvasContext: canvasContext,
        viewport: viewport,
        transform: transform
    });

    console.log("The PDF page has been successfully rendered!");
    return viewport;
}


// Function to compute the list of visualisable content annotations
// A visualisable content annotation is a special annotation of a part of the content of the PDF
// which is associated to an interactive visualisation (which can be displayed/edited)
async function getVisualisableContentAnnotations(page) {
    const annotations = await page.getAnnotations();

    // Only keep "widget" annotations (created as tooltips using pdfcomment package)
    return annotations.filter(annotation => {
        return annotation.annotationType === 20; // tooltip
    });
}


// Function to draw a rectangle around the given annotations
function drawAnnotationFrames(annotations) {
    canvasContext.save();
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = "#0074D9";
    
    for (let annotation of annotations) {
        const [x1, y1, x2, y2] = annotation.rect;
        canvasContext.strokeRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    canvasContext.restore();
}


// Function to check if a mouse event occured inside an annotation
// It assumes the given annotation to be visualisable content annotation
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


// Function to listen to and process clicks on the canvas
// It assumes all given annotations to be visualisable content annotations
function startHandlingCanvasClicks(annotations, viewport) {
    canvas.addEventListener("click", event => {
        for (let annotation of annotations) {
            if (isMousePointerInsideAnnotation(event, annotation, viewport)) {
                onAnnotationClick(event, annotation);
            }
        }
    }); 
}


// Function to process a click on an annotation
// It assumes the given annotation to be visualisable content annotation
function onAnnotationClick(event, annotation) {
    console.log("An annotation is clicked: ", annotation);

    const annotationText = annotation.alternativeText;
    if (annotationText.startsWith("ilatex-visualisation")) {
        const [_, sourceIndexStr] = annotationText.match(/[^\d]+(\d+)/);
        const sourceIndex = parseInt(sourceIndexStr);
        const yOffset = canvas.getBoundingClientRect().top + annotation.rect[3];

        displayVisualisationAtIndex(sourceIndex, yOffset);
    }
}


// Function to listen to and process mouse moves on the canvas
// It assumes all given annotations to be visualisable content annotations
function startHandlingCanvasMouseMoves(annotations, viewport) {
    canvas.addEventListener("mousemove", event => {
        for (let annotation of annotations) {
            if (isMousePointerInsideAnnotation(event, annotation, viewport)) {
                onAnnotationHovering(event, annotation);
            }
        }
    }); 
}


// Function to process a click on an annotation
// It assumes the given annotation to be visualisable content annotation
function onAnnotationHovering(event, annotation) {
    drawAnnotationFrames([annotation]);
}

function displayVisualisationAtIndex(sourceIndex, yOffset) {
    const maskNode = document.createElement("div");
    maskNode.classList.add("visualisation-mask");
    document.body.prepend(maskNode);

    const containerNode = document.createElement("div");
    containerNode.classList.add("visualisation-container");
    containerNode.style.top = `${yOffset}px`;
    maskNode.append(containerNode);

    const visualisationNode = document.querySelector(`.visualisation[data-source-index="${sourceIndex}"]`);
    containerNode.append(visualisationNode);
    console.log("Source index matches node: ", visualisationNode);

    maskNode.addEventListener("click", event => {
        if (event.target !== maskNode) {
            return;
        }

        document.body.append(visualisationNode);
        maskNode.remove();
    });
}

// Start loading the PDF document
loadPDFDocument();