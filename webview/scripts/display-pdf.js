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
    displayPDFPage(page);
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
}