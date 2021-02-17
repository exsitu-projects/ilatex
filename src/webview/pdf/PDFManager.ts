import * as pdfjs from "./PdfJsApi";
import { Messenger } from "../Messenger";
import { PDFRenderer } from "./PDFRenderer";
import { CoreToWebviewMessageType, UpdateCompilationStatusMessage, UpdatePDFMessage, WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { TaskDebouncer } from "../../shared/tasks/TaskDebouncer";
import { PDFOverlayManager } from "./overlay/PDFOverlayManager";
import { PDFOverlayNotification, PDFOverlayNotificationType } from "./overlay/PDFOverlayNotification";
import { PDFOverlayButton } from "./overlay/PDFOverlayButton";
import { VisualisationAvailabilityData, VisualisationViewManager } from "../visualisations/VisualisationViewManager";

const pdfIsCurrentlyCompiledNotification = new PDFOverlayNotification(
    PDFOverlayNotificationType.Loading,
    "Compiling..."
);

export class PDFManager {
    private static readonly WAITING_TIME_BEFORE_PDF_RESIZE: number = 50; // ms
    static readonly PDF_COMPILATION_STARTED_EVENT = "pdf-compilation-started";
    static readonly PDF_CURRENTLY_RECOMPILED_BODY_CLASS = "pdf-currently-compiled";
    static readonly LAST_PDF_COMPILATION_FAILED_BODY_CLASS = "last-pdf-compilation-failed";

    private readonly messenger: Messenger;
    private renderer: PDFRenderer | null;
    private overlayManager: PDFOverlayManager;
    
    private pdfContainerNode: HTMLElement;
    
    private currentPdfUri: string | null;
    private currentPdf: pdfjs.PDFDocument | null;
    private pdfIsCurrentlyCompiled: boolean;

    private codeMappingIdsToVisualisationAvailabilities: Map<number, boolean>;

    private pdfSyncTaskRunner: TaskQueuer;
    private pdfResizeDebouncer: TaskDebouncer;

    private recompilePdfActionButton = new PDFOverlayButton(
        "Recompile",
        "recompile-pdf-button",
        self => {
            this.messenger.sendMessage({
                type: WebviewToCoreMessageType.SaveAndRecompileRequest
            });
        }
    );

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

        this.codeMappingIdsToVisualisationAvailabilities = new Map();

        this.pdfSyncTaskRunner = new TaskQueuer();
        this.pdfResizeDebouncer = new TaskDebouncer(PDFManager.WAITING_TIME_BEFORE_PDF_RESIZE);

        this.startHandlingPdfUpdates();
        this.startHandlingWindowResizes();
        this.startHandlingCompilationStatusChanges();
        this.startHandlingVisualisationAvailabilityChange();

        this.displayPermanentActionButtons();
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

            this.updateAnnotationMaskNodes();
        }
    }

    updateAnnotationMaskNodes(): void {
        // Update the availability of the visualisations
        for (let [codeMappingId, visualisationIsAvailable] of this.codeMappingIdsToVisualisationAvailabilities.entries()) {
            const maskNode = this.pdfContainerNode
                .querySelector(`.annotation-mask[data-code-mapping-id="${codeMappingId}"]`);
            maskNode?.classList.toggle("unavailable", !visualisationIsAvailable);

            // console.log(`New availability for the annotation mask with code mapping ID "${codeMappingId}": ${visualisationIsAvailable}.`);
        }
    }

    displayPermanentActionButtons(): void {
        this.overlayManager.displayActionButton(this.recompilePdfActionButton);
    }

    updatePDFCompilationStatus(pdfIsCurrentlyCompiled: boolean, lastCompilationFailed: boolean): void {
        // If the status does not change, there is nothing to do
        if (this.pdfIsCurrentlyCompiled === pdfIsCurrentlyCompiled) {
            console.warn("The new PDF compilation status is the same than the current status.");
            return;
        }

        // Otherwise, update the current status and the classes of the PDF container node,
        // and display/hide the related notifcation, and signal when a PDF compilation starts
        this.pdfIsCurrentlyCompiled = pdfIsCurrentlyCompiled;

        if (pdfIsCurrentlyCompiled) {
            document.body.classList.add(PDFManager.PDF_CURRENTLY_RECOMPILED_BODY_CLASS);
            this.overlayManager.displayNotification(pdfIsCurrentlyCompiledNotification);
            
            this.emitPDFCompilationStartedEvent();
        }
        else {
            document.body.classList.remove(PDFManager.PDF_CURRENTLY_RECOMPILED_BODY_CLASS);
            pdfIsCurrentlyCompiledNotification.hide();
        }

        document.body.classList.toggle(PDFManager.LAST_PDF_COMPILATION_FAILED_BODY_CLASS, lastCompilationFailed);
    }

    updateAnnotationMaskAvailabilities(availabilityData: VisualisationAvailabilityData[]): void {
        for (let data of availabilityData) {
            this.codeMappingIdsToVisualisationAvailabilities.set(
                data.codeMappingId,
                data.isAvailable
            );
        }

        this.updateAnnotationMaskNodes();
    }

    emitPDFCompilationStartedEvent(): void {
        window.dispatchEvent(new CustomEvent(PDFManager.PDF_COMPILATION_STARTED_EVENT));
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
            this.pdfResizeDebouncer.add(async () => {
                this.pdfSyncTaskRunner.add(async () => {
                    this.renderer?.redraw();
                });
            });
        });
    }

    startHandlingVisualisationAvailabilityChange() {
        window.addEventListener(
            VisualisationViewManager.VISUALISATION_AVAILABILITY_CHANGE_EVENT,
            (event: Event) => {
                const customEvent = event as CustomEvent<VisualisationAvailabilityData[]>;
                this.updateAnnotationMaskAvailabilities(customEvent.detail);
            }
        );
    }

    startHandlingCompilationStatusChanges(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateCompilationStatus,
            (message: UpdateCompilationStatusMessage)=> {
                this.updatePDFCompilationStatus(message.pdfIsCurrentlyCompiled, message.lastCompilationFailed);
            }
        );
    }
}