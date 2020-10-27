import * as pdfjs from "./PdfJsApi";
import { Messenger } from "../Messenger";
import { PDFRenderer } from "./PDFRenderer";
import { CoreToWebviewMessageType, UpdatePDFMessage } from "../../shared/messenger/messages";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { TaskDebouncer } from "../../shared/tasks/TaskDebouncer";

export class PDFManager {
    private static readonly DELAY_BETWEEN_PDF_RESIZES: number = 50; // ms
    static readonly UPDATE_PDF_EVENT = "update-pdf";

    private readonly messenger: Messenger;
    private renderer: PDFRenderer | null;
    
    private pdfContainerNode: HTMLElement;
    
    private currentPdfUri: string | null;
    private currentPdf: pdfjs.PDFDocument | null;

    private pdfSyncTaskRunner: TaskQueuer;
    private pdfResizingRequestDebouncer: TaskDebouncer;

    constructor(messenger: Messenger) {
        this.messenger = messenger;
        this.renderer = null;

        this.pdfContainerNode = document.createElement("section");
        this.pdfContainerNode.setAttribute("id", "pdf-container");
        document.body.append(this.pdfContainerNode);

        this.currentPdfUri = null;
        this.currentPdf = null;

        this.pdfSyncTaskRunner = new TaskQueuer();
        this.pdfResizingRequestDebouncer = new TaskDebouncer(PDFManager.DELAY_BETWEEN_PDF_RESIZES);

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

    async updatePDF(pdfUri: string) {
        // Try loading the PDF at the given URI (possibly the same)
        const loadingSuccess = await this.loadPDF(pdfUri);

        // If it could be successfuly loaded, replace the old renderer by the new renderer
        // Otherwise, do nothing (the error should have already been reported by the loading method)
        if (loadingSuccess) {
            const newRenderer = new PDFRenderer(this.currentPdf);
            this.renderer = newRenderer;

            await newRenderer.init();
            await newRenderer.redraw(this.pdfContainerNode);
        }
    }

    startHandlingPdfUpdates() {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdatePDF,
            async (message: UpdatePDFMessage) => {
                this.pdfSyncTaskRunner.add(async () => {
                    return this.updatePDF(message.pdfUri);
                });
            }
        );
    }

    startHandlingWindowResizes() {
        window.addEventListener("resize", async event => {
            this.pdfResizingRequestDebouncer.add(async () => {
                this.pdfSyncTaskRunner.add(async () => {
                    this.renderer?.redraw();
                });
            });
        });
    }
}