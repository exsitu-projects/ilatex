// Get a reference to PDF.js
const pdfjsLib = window["pdfjsLib"];

// Get the PDF viewer node
// If it does not exist (i.e. no PDF file was found), skip the rest of the script
const pdfViewerNode = document.querySelector("#pdf-viewer");

// Add a canvas to the DOM (to display pages from the PDF afterwards)
const canvas = document.createElement("canvas");
const canvasContext = canvas.getContext("2d");
pdfViewerNode.append(canvas);


// Load the PDF document
if (pdfViewerNode) {
    const pdfUri = pdfViewerNode.getAttribute("data-pdf-uri");
    const workerUri = pdfViewerNode.getAttribute("data-pdfjs-worker-uri");

    // Specify the URI to the required worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.worker.min.js";

    console.log("Start loading the PDF...");
    pdfjsLib
        .getDocument(pdfUri)
        .promise
        .then(function(pdf) {
            console.log("The PDF has finished loading!");
            console.log(pdf);
            return pdf;
        })
        .then(onPDFDocumentLoaded);
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
    // drawAnnotations(allAnnotations);

    const annotations = await getVisualisableContentAnnotations(page);
    drawVisualisableContentAnnotations(annotations);
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


function drawAnnotations(annotations) {
    canvasContext.save();
    canvasContext.lineWidth = 1;
    canvasContext.strokeStyle = "green";

    for (let annotation of annotations) {
        const [x1, y1, x2, y2] = annotation.rect;
        canvasContext.strokeRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    canvasContext.restore();
}


function drawVisualisableContentAnnotations(annotations) {
    canvasContext.save();
    canvasContext.lineWidth = 1;
    canvasContext.strokeStyle = "red";

    for (let annotation of annotations) {
        const [x1, y1, x2, y2] = annotation.rect;
        
        console.log("draw annotation at", x1, y1, " of size ", Math.abs(x2 - x1), Math.abs(y2 - y1));
        canvasContext.strokeRect(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    canvasContext.restore();
}


// Function to listen to and process clicks on the canvas
// For now, only clicks on visualisable content annotations are processed
function startHandlingCanvasClicks(annotations, viewport) {
    // console.log("viewport = ", viewport);

    function isAnnotationClicked(annotation, event) {
        // TODO: better explain the role of the values taken fron the transform matrix
        // TODO: take the position of the canvas into account in case the page is scrolled?
        const mouseX = (window.scrollX + event.clientX) / viewport.transform[0];
        const mouseY = ((window.scrollY + event.clientY) - viewport.transform[5]) / viewport.transform[3];
        const [x1, y1, x2, y2] = annotation.rect;

        return mouseX >= x1
            && mouseX <= x2
            && mouseY >= y1
            && mouseY <= y2;
    }

    canvas.addEventListener("click", event => {
        // console.log("click at", event.clientX, event.clientY);
        for (let annotation of annotations) {
            if (isAnnotationClicked(annotation, event)) {
                console.log("An annotation is clicked: ", annotation);
            }
        }
    }); 
}