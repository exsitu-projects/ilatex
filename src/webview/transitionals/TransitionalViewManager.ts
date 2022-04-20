import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";
import { Messenger } from "../Messenger";
import { TransitionalPopup } from "./TransitionalPopup";
import {  CoreToWebviewMessageType, UpdateTransitionalContentMessage, UpdateTransitionalMetadataMessage } from "../../shared/messenger/messages";
import { TransitionalMetadata } from "../../shared/transitionals/types";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { PDFManager } from "../pdf/PDFManager";
import { TransitionalViewContext } from "./TransitionalViewContext";
import { TransitionalViewProvider } from "./TransitionalViewProvider";
import { TransitionalView } from "./TransitionalView";
import { TRANSITIONAL_VIEW_PROVIDERS } from "../../transitionals/view-providers";

export interface TransitionalDisplayRequest {
    codeMappingId: number;
    annotationMaskCoordinates: AnnotationMaskCoordinates;
    pdfPageDetail: {
        pageNumber: number;
        width: number;
        height: number;
        scale: number;
    }
}

interface TransitionalData {
    contentNode?: HTMLElement;
    metadata?: TransitionalMetadata;
}

export interface TransitionalAvailabilityData {
    codeMappingId: number;
    isAvailable: boolean;
}

export class TransitionalViewManager {
    static readonly REQUEST_TRANSITIONAL_DISPLAY_EVENT = "request-transitional-display";
    static readonly TRANSITIONAL_AVAILABILITY_CHANGE_EVENT = "transitional-availability-change";
    static readonly TRANSITIONALS_ARE_UNAVAILABLE_BODY_CLASS = "transitionals-unavailable";
    static readonly TRANSITIONALS_ARE_DISABLED_BODY_CLASS = "transitionals-disabled";


    private messenger: Messenger;

    private transitionalNamesToViewProviders: Map<string, TransitionalViewProvider>;
    private codeMappingIdsToTransitionalData: Map<number, TransitionalData>;
    private transitionalDataUpdateTaskQueuer: TaskQueuer;

    private currentlyDisplayedTransitionalPopup: TransitionalPopup | null;

    constructor(messenger: Messenger) {
        this.messenger = messenger;

        this.transitionalNamesToViewProviders = new Map(
            TRANSITIONAL_VIEW_PROVIDERS
                .map(provider => [provider.transitionalName, provider])
        );

        this.codeMappingIdsToTransitionalData = new Map();
        this.transitionalDataUpdateTaskQueuer = new TaskQueuer();

        this.currentlyDisplayedTransitionalPopup = null;

        this.startHandlingTransitionalDisplayRequests();
        this.startHandlingPdfEvents();
        this.startHandlingWebviewMessages();
    }

    get currentlyDisplayedTransitionalView(): TransitionalView | null {
        return this.currentlyDisplayedTransitionalPopup?.transitionalView ?? null;
    }

    get hasCurrentlyDisplayedTransitionalView(): boolean {
        return this.currentlyDisplayedTransitionalPopup !== null;
    }

    setTransitionalsGloballyEnabled(enable: boolean): void {
        // If transitionals are globally disabled, tag the body element with a dedicated class
        // and hide the currently displayed transitional (if any)
        document.body.classList.toggle(
            TransitionalViewManager.TRANSITIONALS_ARE_DISABLED_BODY_CLASS, 
            !enable
        );
        
        // If transitionals have possibly become globally disabled, hide the currently displayed transitional (if any)
        if (!enable) {
            this.hideCurrentlyDisplayedTransitional();
        }

        // Signal that the availability of the transitional may have changed
        this.emitTransitionalAvailabilityChangeEvent();
    }

    private ensureTransitionalDataExistsForCodeMappingId(codeMappingId: number): void {
        if (!this.codeMappingIdsToTransitionalData.has(codeMappingId)) {
            this.codeMappingIdsToTransitionalData.set(codeMappingId, {});
        }
    }

    private getTransitionalDataWithCodeMappingId(codeMappingId: number): TransitionalData | null {
        return this.codeMappingIdsToTransitionalData.get(codeMappingId) ?? null;
    }

    private processTransitionalDisplayRequest(request: TransitionalDisplayRequest): void {
        // Get the transitional data for the requeted code mapping ID and ensure that
        // 1. both the content and the metadata exist in this manager;
        // 1. the transitional is currently available;
        // 2. there is a view factory for this type of transitional.
        const data = this.getTransitionalDataWithCodeMappingId(request.codeMappingId);
        if (!data || !data.contentNode || !data.metadata) {
            console.warn(`Transitional data (content or metadata) is missing for code mapping ID "${request.codeMappingId}".`);
            return;
        }

        if (!data.metadata.available) {
            console.warn(`Transitional with code mapping ID "${request.codeMappingId}" is not available: it cannot be displayed.`);
            return;
        }

        const transitionalName = data.metadata.name;
        if (!this.transitionalNamesToViewProviders.has(transitionalName)) {
            console.warn(`There is no view factory for transitionals named "${transitionalName}": it cannot be displayed.`);
            return;           
        }

        // Clone the content node and display a new view in a transitional popup
        const clonedContentNode = TransitionalViewManager.cloneTransitionalContentNode(data.contentNode);
        
        const factory = this.transitionalNamesToViewProviders.get(transitionalName)!;
        const view = factory.createView(clonedContentNode, data.metadata, new TransitionalViewContext(
            request.codeMappingId,
            this.messenger,
            request.annotationMaskCoordinates,
            request.pdfPageDetail
        ));

        const popup = new TransitionalPopup(view, () => {
            this.currentlyDisplayedTransitionalPopup = null;
        });

        this.currentlyDisplayedTransitionalPopup = popup;
    }

    private hideCurrentlyDisplayedTransitional(): void {
        if (!this.hasCurrentlyDisplayedTransitionalView) {
            return;
        }
        
        this.currentlyDisplayedTransitionalPopup!.close();
    }

    private handleTransitionalDisplayRequest(request: TransitionalDisplayRequest): void {
        // Ensure no transitional is displayed
        this.hideCurrentlyDisplayedTransitional();

        // Process the display request
        this.processTransitionalDisplayRequest(request);
    }

    private updateCurrentlyDisplayedTransitionalContent(): void {
        if (!this.hasCurrentlyDisplayedTransitionalView) {
            return;
        }

        const transitionalPopup = this.currentlyDisplayedTransitionalPopup!;
        const transitionalView = this.currentlyDisplayedTransitionalView!;

        const codeMappingId = transitionalView.codeMappingId;
        const data = this.getTransitionalDataWithCodeMappingId(codeMappingId);
        if (!data || !data.contentNode) {
            console.warn(`Transitional content is missing for the currently displayed transitional (with code mapping ID "${codeMappingId}"): the view cannot be updated.`);
            return;
        }

        const clonedContentNode = TransitionalViewManager.cloneTransitionalContentNode(data.contentNode);
        transitionalView.updateContentWith(clonedContentNode);
        transitionalPopup.onAfterVisualationContentUpdate();        
    }

    private updateCurrentlyDisplayedTransitionalMetadata(): void {
        if (!this.hasCurrentlyDisplayedTransitionalView) {
            return;
        }

        const transitionalPopup = this.currentlyDisplayedTransitionalPopup!;
        const transitionalView = this.currentlyDisplayedTransitionalView!;

        const codeMappingId = transitionalView.codeMappingId;
        const data = this.getTransitionalDataWithCodeMappingId(codeMappingId);
        if (!data || !data.metadata) {
            console.warn(`Transitional metadata is missing for the currently displayed transitional (with code mapping ID "${codeMappingId}"): the view cannot be updated.`);
            return;
        }

        transitionalView.updateMetadataWith(data.metadata);
        transitionalPopup.onAfterTransitionalMetadataUpdate();        
    }

    private updateTransitionalContent(codeMappingId: number, newContentAsHtml: string): void {
        // Get the current data for the given code mapping ID, or create it if needed
        this.ensureTransitionalDataExistsForCodeMappingId(codeMappingId);
        const data = this.getTransitionalDataWithCodeMappingId(codeMappingId)!;

        // Create an HTML element from the given content string and update the data with it
        const temporaryContainerNode = document.createElement("template");
        temporaryContainerNode.innerHTML = newContentAsHtml;

        data.contentNode = temporaryContainerNode.content.firstElementChild as HTMLElement;

        // Possibly update the currently displayed transitional (if there is one)
        if (this.currentlyDisplayedTransitionalView?.codeMappingId === codeMappingId) {
            this.updateCurrentlyDisplayedTransitionalContent();
        }
    }

    private updateTransitionalMetadata(codeMappingId: number, newMetadata: TransitionalMetadata): void {
        // Get the current data for the given code mapping ID, or create it if needed
        this.ensureTransitionalDataExistsForCodeMappingId(codeMappingId);
        const data = this.getTransitionalDataWithCodeMappingId(codeMappingId)!;

        // Update the data with the new metadata
        data.metadata = newMetadata;

        // Possibly update the currently displayed transitional (if there is one)
        if (this.currentlyDisplayedTransitionalView?.codeMappingId === codeMappingId) {
            this.updateCurrentlyDisplayedTransitionalMetadata();
        }
        
        // Signal that the availability of the transitional may have changed
        this.emitTransitionalAvailabilityChangeEvent([codeMappingId]);
    }

    private emitTransitionalAvailabilityChangeEvent(onlyCodeMappingToInclude?: number[]): void {
        let dataOfAllIncludedTransitionals = [...this.codeMappingIdsToTransitionalData.entries()];
        if (onlyCodeMappingToInclude) {
            dataOfAllIncludedTransitionals = dataOfAllIncludedTransitionals
                .filter(([codeMappingId, data]) => onlyCodeMappingToInclude.includes(codeMappingId));
        }

        window.dispatchEvent(new CustomEvent<TransitionalAvailabilityData[]>(
            TransitionalViewManager.TRANSITIONAL_AVAILABILITY_CHANGE_EVENT,
            {
                detail: dataOfAllIncludedTransitionals.map(([codeMappingId, data]) => {
                    return {
                        codeMappingId: codeMappingId,
                        isAvailable: (data.metadata !== undefined && data.metadata.available)
                    };
                })
            }
        ));
    }

    private startHandlingTransitionalDisplayRequests(): void {
        window.addEventListener(
            TransitionalViewManager.REQUEST_TRANSITIONAL_DISPLAY_EVENT,
            (event: Event) => {
                const customEvent = event as CustomEvent<TransitionalDisplayRequest>;
                this.handleTransitionalDisplayRequest(customEvent.detail);
            }
        );
    }

    private startHandlingPdfEvents(): void {
        window.addEventListener(
            PDFManager.PDF_COMPILATION_STARTED_EVENT,
            (event: Event) => {
                this.hideCurrentlyDisplayedTransitional();
            }
        );

        window.addEventListener(
            PDFManager.PDF_WILL_RESIZE_EVENT,
            (event: Event) => {
                this.currentlyDisplayedTransitionalPopup?.onBeforePdfResize();
            }
        );

        window.addEventListener(
            PDFManager.PDF_DID_RESIZE_EVENT,
            (event: Event) => {
                this.currentlyDisplayedTransitionalPopup?.onAfterPdfResize();
            }
        );
    }

    private startHandlingWebviewMessages(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateTransitionalContent,
            async (message: UpdateTransitionalContentMessage) => {
                this.transitionalDataUpdateTaskQueuer.add(async () => {
                    this.updateTransitionalContent(message.codeMappingId, message.contentAsHtml);
                });
            }
        );

        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateTransitionalMetadata,
            async (message: UpdateTransitionalMetadataMessage) => {
                this.transitionalDataUpdateTaskQueuer.add(async () => {
                    this.updateTransitionalMetadata(message.codeMappingId, message.metadata);
                });
            }
        );
    }

    private static cloneTransitionalContentNode(node: HTMLElement): HTMLElement {
        return node.cloneNode(true) as HTMLElement;
    }
}