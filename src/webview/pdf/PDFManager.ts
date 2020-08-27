import * as pdfjs from "./PdfJsApi";
import { Messenger } from "../Messenger";
import { PDFRenderer } from "./PDFRenderer";
import { CoreToWebviewMessageType, UpdatePDFMessage } from "../../shared/messenger/messages";

export class PDFManager {
    static readonly UPDATE_PDF_EVENT = "update-pdf";

    private readonly messenger: Messenger;
    private renderer: PDFRenderer | null;

    private currentPdfUri: string | null;
    private currentPdf: pdfjs.PDFDocument | null;

    constructor(messenger: Messenger) {
        this.messenger = messenger;
        this.renderer = null;

        this.currentPdfUri = null;
        this.currentPdf = null;

        this.startHandlingPdfUpdates();
        this.startHandlingWindowResizes();
    }

    async loadPDF(pdfUri: string): Promise<boolean> {
        try {
            this.currentPdf = await pdfjs.lib.getDocument(pdfUri).promise;
            this.currentPdfUri = pdfUri;

            return true;
        }
        catch (error) {
            console.log("The loading of the PDF failed:", error);

            return false;
        }
    }

    async handlePdfUpdate(message: UpdatePDFMessage) {
        // Try loading the PDF at the given URI (possibly the same)
        const loadingSuccess = await this.loadPDF(message.pdfUri);

        // If it could be successfuly loaded, replace the old renderer by the new renderer
        // Otherwise, do nothing (the error should have already been reported by the loading method)
        if (loadingSuccess) {
            const newRenderer = new PDFRenderer(this.currentPdf);
            this.renderer = newRenderer;

            await newRenderer.init();
            await newRenderer.redraw();
        }
    }

    startHandlingPdfUpdates() {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdatePDF,
            async (message: UpdatePDFMessage) => {
                this.handlePdfUpdate(message);
            }
        );
    }

    async handleWindowResize(event: UIEvent) {
        // Simply re-draw the current PDF using the current renderer
        if (this.renderer) {
            await this.renderer.redraw();
        }
    }

    startHandlingWindowResizes() {
        window.addEventListener("resize", async event => {
            this.handleWindowResize(event);
        });
    }
}