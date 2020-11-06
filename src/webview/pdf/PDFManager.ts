import * as pdfjs from "./PdfJsApi";
import { Messenger } from "../Messenger";
import { PDFRenderer } from "./PDFRenderer";
import { CoreToWebviewMessageType, UpdateCompilationStatusMessage, UpdatePDFMessage } from "../../shared/messenger/messages";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { TaskDebouncer } from "../../shared/tasks/TaskDebouncer";
import { PDFOverlayManager } from "./overlay/PDFOverlayManager";
import { PDFOverlayNotification, PDFOverlayNotificationType } from "./overlay/PDFOverlayNotification";

const pdfIsCurrentlyCompiledNotification = new PDFOverlayNotification(
    PDFOverlayNotificationType.Loading,
    "Compiling..."
);

export class PDFManager {
    private static readonly DELAY_BETWEEN_PDF_RESIZES: number = 50; // ms
    static readonly UPDATE_PDF_EVENT = "update-pdf";

    private readonly messenger: Messenger;
    private renderer: PDFRenderer | null;
    private overlayManager: PDFOverlayManager;
    
    private pdfContainerNode: HTMLElement;
    
    private currentPdfUri: string | null;
    private currentPdf: pdfjs.PDFDocument | null;
    private pdfIsCurrentlyCompiled: boolean;

    private pdfSyncTaskRunner: TaskQueuer;
    private pdfResizingRequestDebouncer: TaskDebouncer;

    constructor(messenger: Messenger) {
        this.messenger = messenger;
        this.renderer = null;
        this.overlayManager = new PDFOverlayManager();

        this.pdfContainerNode = document.createElement("section");
        this.pdfContainerNode.setAttribute("id", "pdf-container");
        document.body.append(this.pdfContainerNode);

        this.currentPdfUri = null;
        this.currentPdf = null;
        this.pdfIsCurrentlyCompiled = false;

        this.pdfSyncTaskRunner = new TaskQueuer();
        this.pdfResizingRequestDebouncer = new TaskDebouncer(PDFManager.DELAY_BETWEEN_PDF_RESIZES);

        this.startHandlingPdfUpdates();
        this.startHandlingWindowResizes();
        this.startHandlingCompilationStatusChanges();
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

    updatePDFCompilationStatus(pdfIsCurrentlyCompiled: boolean): void {
        // If the status does not change, there is nothing to do
        if (this.pdfIsCurrentlyCompiled === pdfIsCurrentlyCompiled) {
            console.warn("The new PDF compilation status is the same than the current status.");
            return;
        }

        // Otherwise, update the current status and the classes of the PDF container node,
        // and display/hide the related notifcation
        this.pdfIsCurrentlyCompiled = pdfIsCurrentlyCompiled;

        if (pdfIsCurrentlyCompiled) {
            document.body.classList.add("pdf-currently-compiled");
            this.overlayManager.displayNotification(pdfIsCurrentlyCompiledNotification);
        }
        else {
            document.body.classList.remove("pdf-currently-compiled");
            pdfIsCurrentlyCompiledNotification.hide();
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

    startHandlingCompilationStatusChanges(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateCompilationStatus,
            (message: UpdateCompilationStatusMessage)=> {
                this.updatePDFCompilationStatus(message.pdfIsCurrentlyCompiled);
            }
        );
    }
}