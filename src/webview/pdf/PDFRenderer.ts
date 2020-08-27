import * as pdfjs from "./PdfJsApi";
import { PDFPageRenderer } from "./PDFPageRenderer";

export class PDFRenderer {
    private pdf: pdfjs.PDFDocument;

    private pageContainerNode: HTMLElement;
    private annotationMaskContainerNode: HTMLElement;
    
    private nbPages: number;
    private pageRenderers: Map<number, PDFPageRenderer>;

    constructor(pdf: pdfjs.PDFDocument) {
        this.pdf = pdf;

        // Create a container for the canvases of the pages
        this.pageContainerNode = document.createElement("div");
        this.pageContainerNode.classList.add("pdf-page-container");

        // Create a container for the annotation masks
        this.annotationMaskContainerNode = document.createElement("div");
        this.annotationMaskContainerNode.classList.add("pdf-annotation-mask-container");

        this.nbPages = pdf.numPages;
        this.pageRenderers = new Map();
    }

    async init() {
        await this.loadAndRenderAllPages();
    }

    async loadAndRenderPage(pageNumber: number) {
        const renderer = await PDFPageRenderer.fromPDFDocument(this.pdf, pageNumber);
        this.pageRenderers.set(pageNumber, renderer);
    }

    async loadAndRenderAllPages() {
        if (this.nbPages === 0) {
            console.log("The PDF contains no pages: there is nothing to load.");
            return;
        }

        for (let pageNumber = 1; pageNumber <= this.nbPages; pageNumber++) {
            await this.loadAndRenderPage(pageNumber);
        }
    }

    updatePageContainerCanvases() {
        this.pageContainerNode.innerHTML = "";

        for (let pageRenderer of this.pageRenderers.values()) {
            this.pageContainerNode.append(pageRenderer.getCanvas()!);
        }
    }

    createAllAnnotationMasks() {
        for (let pageRenderer of this.pageRenderers.values()) {
            pageRenderer.createAnnotationMasks();
            this.annotationMaskContainerNode.append(
                ...pageRenderer.getAnnotationMasks()
            );
        }
    }

    removeAllAnnotationsMasks() {
        for (let pageRenderer of this.pageRenderers.values()) {
            pageRenderer.removeAnnotationMasks();
        }

        this.annotationMaskContainerNode.innerHTML = "";
    }

    appendTo(node: HTMLElement) {
        node.append(this.pageContainerNode);
        node.append(this.annotationMaskContainerNode);
    }

    async redraw(newContainerNode?: HTMLElement) {
        this.removeAllAnnotationsMasks();

        // Draw all the pages
        await Promise.all([...this.pageRenderers.values()]
            .map(page => page.redraw())
        );

        if (newContainerNode) {
            newContainerNode.innerHTML = "";
            this.appendTo(newContainerNode);
        }

        // Create the (new) annotation masks
        // This requires the (new) page canvases to be appended to the DOM
        // since their positions are required to compute the absolute positions
        // of the masks (see the related methods in DisplayablePDFPage)
        this.updatePageContainerCanvases();
        this.createAllAnnotationMasks();
    }

    static async fromURI(uri: string) {
        const maxNbAttempts = 8;
        let currentAttempt = 1;
        let displayablePdf = null;

        console.log("Start loading the PDF at: ", uri);
        while (!displayablePdf && currentAttempt <= maxNbAttempts) {
            console.log("Loading attempt " + currentAttempt);
            currentAttempt += 1;
            try {
                const pdf = await pdfjs.lib.getDocument(uri).promise;
                displayablePdf = new PDFRenderer(pdf);
            }
            catch (error) {
                console.log("PDF loading failed: ", error);
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