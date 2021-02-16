import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";
import { Messenger } from "../Messenger";
import { VisualisationView, VisualisationViewFactory } from "./VisualisationView";
import { VisualisationPopup } from "./VisualisationPopup";
import {  CoreToWebviewMessageType, UpdateVisualisationContentMessage, UpdateVisualisationMetadataMessage } from "../../shared/messenger/messages";
import { GridLayoutViewFactory } from "../../visualisations/gridlayout/view/view";
import { MathematicsViewFactory } from "../../visualisations/mathematics/view/view";
import { TabularViewFactory } from "../../visualisations/tabular/view/view";
import { IncludegraphicsViewFactory } from "../../visualisations/includegraphics/view/view";
import { VisualisationMetadata } from "../../shared/visualisations/types";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";

export interface VisualisationDisplayRequest {
    codeMappingId: number;
    annotationMaskCoordinates: AnnotationMaskCoordinates;
    pdfPageDetail: {
        pageNumber: number;
        width: number;
        height: number;
        scale: number;
    }
}

interface VisualisationData {
    contentNode?: HTMLElement;
    metadata?: VisualisationMetadata;
}

export interface VisualisationAvailabilityData {
    codeMappingId: number;
    isAvailable: boolean;
}

export class VisualisationViewManager {
    static readonly REQUEST_VISUALISATION_DISPLAY_EVENT = "request-visualisation-display";
    static readonly VISUALISATION_AVAILABILITY_CHANGE_EVENT = "visualisation-availability-change";
    static readonly VISUALISATIONS_ARE_UNAVAILABLE_BODY_CLASS = "visualisations-unavailable";
    private static readonly AVAILABLE_VISUALISATION_FACTORIES: VisualisationViewFactory[] = [
        new IncludegraphicsViewFactory(),
        new TabularViewFactory(),
        new GridLayoutViewFactory(),
        new MathematicsViewFactory()
    ];

    private messenger: Messenger;

    private visualisationNamesToViewFactories: Map<string, VisualisationViewFactory>;
    private codeMappingIdsToVisualisationData: Map<number, VisualisationData>;
    private visualisationDataUpdateTaskQueuer: TaskQueuer;

    private currentlyDisplayedVisualisationPopup: VisualisationPopup | null;

    constructor(messenger: Messenger) {
        this.messenger = messenger;

        this.visualisationNamesToViewFactories = new Map(
            VisualisationViewManager.AVAILABLE_VISUALISATION_FACTORIES
                .map(factory => [factory.visualisationName, factory])
        );

        this.codeMappingIdsToVisualisationData = new Map();
        this.visualisationDataUpdateTaskQueuer = new TaskQueuer();

        this.currentlyDisplayedVisualisationPopup = null;

        this.startHandlingVisualisationDisplayRequests();
        this.startHandlingWebviewMessages();
    }

    get currentlyDisplayedVisualisationView(): VisualisationView | null {
        return this.currentlyDisplayedVisualisationPopup?.visualisationView ?? null;
    }

    get hasCurrentlyDisplayedVisualisationView(): boolean {
        return this.currentlyDisplayedVisualisationPopup !== null;
    }

    private ensureVisualisationDataExistsForCodeMappingId(codeMappingId: number): void {
        if (!this.codeMappingIdsToVisualisationData.has(codeMappingId)) {
            this.codeMappingIdsToVisualisationData.set(codeMappingId, {});
        }
    }

    private getVisualisationDataWithCodeMappingId(codeMappingId: number): VisualisationData | null {
        return this.codeMappingIdsToVisualisationData.get(codeMappingId) ?? null;
    }

    private processVisualisationDisplayRequest(request: VisualisationDisplayRequest): void {
        // Get the visualisation data for the requeted code mapping ID and ensure that
        // 1. both the content and the metadata exist in this manager;
        // 1. the visualisation is currently available;
        // 2. there is a view factory for this type of visualisation.
        const data = this.getVisualisationDataWithCodeMappingId(request.codeMappingId);
        if (!data || !data.contentNode || !data.metadata) {
            console.warn(`Visualisation data (content or metadata) is missing for code mapping ID "${request.codeMappingId}".`);
            return;
        }

        if (!data.metadata.available) {
            console.warn(`Visualisation with code mapping ID "${request.codeMappingId}" is not available: it cannot be displayed.`);
            return;
        }

        const visualisationName = data.metadata.name;
        if (!this.visualisationNamesToViewFactories.has(visualisationName)) {
            console.warn(`There is no view factory for visualisations named "${visualisationName}": it cannot be displayed.`);
            return;           
        }

        // Clone the content node and display a new view in a visualisation popup
        const clonedContentNode = VisualisationViewManager.cloneVisualisationContentNode(data.contentNode);
        
        const factory = this.visualisationNamesToViewFactories.get(visualisationName)!;
        const view = factory.createView(clonedContentNode, data.metadata, {
            messenger: this.messenger,
            annotationMaskCoordinates: request.annotationMaskCoordinates,
            pdfPageDetail: request.pdfPageDetail
        });

        const popup = new VisualisationPopup(view, request.annotationMaskCoordinates, () => {
            this.currentlyDisplayedVisualisationPopup = null;
        });

        this.currentlyDisplayedVisualisationPopup = popup;
    }

    private hideCurrentlyDisplayedVisualisation(): void {
        if (!this.hasCurrentlyDisplayedVisualisationView) {
            return;
        }
        
        this.currentlyDisplayedVisualisationPopup!.close();
    }

    private handleVisualisationDisplayRequest(request: VisualisationDisplayRequest): void {
        // Ensure no visualisation is displayed
        this.hideCurrentlyDisplayedVisualisation();

        // Process the display request
        this.processVisualisationDisplayRequest(request);
    }  

    private startHandlingVisualisationDisplayRequests(): void {
        window.addEventListener(
            VisualisationViewManager.REQUEST_VISUALISATION_DISPLAY_EVENT,
            (event: Event) => {
                const customEvent = event as CustomEvent<VisualisationDisplayRequest>;
                this.handleVisualisationDisplayRequest(customEvent.detail);
            }
        );
    }

    private updateCurrentlyDisplayedVisualisationContent(): void {
        if (!this.hasCurrentlyDisplayedVisualisationView) {
            return;
        }

        const visualisationPopup = this.currentlyDisplayedVisualisationPopup!;
        const visualisationView = this.currentlyDisplayedVisualisationView!;

        const codeMappingId = visualisationView.codeMappingId;
        const data = this.getVisualisationDataWithCodeMappingId(codeMappingId);
        if (!data || !data.contentNode) {
            console.warn(`Visualisation content is missing for the currently displayed visualisation (with code mapping ID "${codeMappingId}"): the view cannot be updated.`);
            return;
        }

        const clonedContentNode = VisualisationViewManager.cloneVisualisationContentNode(data.contentNode);
        visualisationView.updateContentWith(clonedContentNode);
        visualisationPopup.onAfterVisualationContentUpdate();        
    }

    private updateCurrentlyDisplayedVisualisationMetadata(): void {
        if (!this.hasCurrentlyDisplayedVisualisationView) {
            return;
        }

        const visualisationPopup = this.currentlyDisplayedVisualisationPopup!;
        const visualisationView = this.currentlyDisplayedVisualisationView!;

        const codeMappingId = visualisationView.codeMappingId;
        const data = this.getVisualisationDataWithCodeMappingId(codeMappingId);
        if (!data || !data.metadata) {
            console.warn(`Visualisation metadata is missing for the currently displayed visualisation (with code mapping ID "${codeMappingId}"): the view cannot be updated.`);
            return;
        }

        visualisationView.updateMetadataWith(data.metadata);
        visualisationPopup.onAfterVisualisationMetadataUpdate();        
    }

    private updateVisualisationContent(codeMappingId: number, newContentAsHtml: string): void {
        // Get the current data for the given code mapping ID, or create it if needed
        this.ensureVisualisationDataExistsForCodeMappingId(codeMappingId);
        const data = this.getVisualisationDataWithCodeMappingId(codeMappingId)!;

        // Create an HTML element from the given content string and update the data with it
        const temporaryContainerNode = document.createElement("template");
        temporaryContainerNode.innerHTML = newContentAsHtml;

        data.contentNode = temporaryContainerNode.content.firstElementChild as HTMLElement;

        // Possibly update the currently displayed visualisation (if there is one)
        this.updateCurrentlyDisplayedVisualisationContent();
    }

    private updateVisualisationMetadata(codeMappingId: number, newMetadata: VisualisationMetadata): void {
        // Get the current data for the given code mapping ID, or create it if needed
        this.ensureVisualisationDataExistsForCodeMappingId(codeMappingId);
        const data = this.getVisualisationDataWithCodeMappingId(codeMappingId)!;

        // Update the data with the new metadata
        data.metadata = newMetadata;

        // Possibly update the currently displayed visualisation (if there is one)
        this.updateCurrentlyDisplayedVisualisationMetadata();

        // Signal that the availability of the visualisation may have changed
        this.emitVisualisationAvailabilityChangeEvent([codeMappingId]);
    }

    private emitVisualisationAvailabilityChangeEvent(onlyCodeMappingToInclude?: number[]): void {
        let dataOfAllIncludedVisualisations = [...this.codeMappingIdsToVisualisationData.entries()];
        if (onlyCodeMappingToInclude) {
            dataOfAllIncludedVisualisations = dataOfAllIncludedVisualisations
                .filter(([codeMappingId, data]) => onlyCodeMappingToInclude.includes(codeMappingId));
        }

        window.dispatchEvent(new CustomEvent<VisualisationAvailabilityData[]>(
            VisualisationViewManager.VISUALISATION_AVAILABILITY_CHANGE_EVENT,
            {
                detail: dataOfAllIncludedVisualisations.map(([codeMappingId, data]) => {
                    return {
                        codeMappingId: codeMappingId,
                        isAvailable: (data.metadata !== undefined && data.metadata.available)
                    };
                })
            }
        ));
    }

    private startHandlingWebviewMessages(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateVisualisationContent,
            async (message: UpdateVisualisationContentMessage) => {
                this.visualisationDataUpdateTaskQueuer.add(async () => {
                    this.updateVisualisationContent(message.codeMappingId, message.contentAsHtml);
                });
            }
        );

        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateVisualisationMetadata,
            async (message: UpdateVisualisationMetadataMessage) => {
                this.visualisationDataUpdateTaskQueuer.add(async () => {
                    this.updateVisualisationMetadata(message.codeMappingId, message.metadata);
                });
            }
        );
    }

    private static cloneVisualisationContentNode(node: HTMLElement): HTMLElement {
        return node.cloneNode(true) as HTMLElement;
    }
}