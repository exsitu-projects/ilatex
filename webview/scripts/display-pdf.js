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
    // TODO: handle more pages + page change?
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
// By default, the page is scaled so that its width is equal to the width of the webview
function displayPDFPage(page) {
    const webviewWidth = document.body.clientWidth;
    const pageWidth = page.view[2];
    const scale = webviewWidth / pageWidth;

    console.log("client width", webviewWidth);

    const viewport = page.getViewport({ scale: scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    page.render({
        canvasContext: canvasContext,
        viewport: viewport
    });

    console.log("The PDF page has been successfully rendered!");
    console.log("scale = " + scale + ", viewport = ", viewport);
}