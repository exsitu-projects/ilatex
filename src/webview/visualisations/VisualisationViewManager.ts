import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";
import { Messenger } from "../Messenger";
import { VisualisationView, VisualisationViewFactory } from "./VisualisationView";
import { VisualisationPopup } from "./VisualisationPopup";
import {  CoreToWebviewMessageType, UpdateOneVisualisationMessage, UpdateAllVisualisationsMessage, UpdateOneVisualisationStatusMessage, UpdateAllVisualisationsStatusMessage } from "../../shared/messenger/messages";
import { GridLayoutViewFactory } from "../../visualisations/gridlayout/view/view";
import { MathematicsViewFactory } from "../../visualisations/mathematics/view/view";

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

export class VisualisationViewManager {
    static readonly REQUEST_VISUALISATION_DISPLAY_EVENT = "request-visualisation-display";
    static readonly VISUALISATIONS_ARE_UNAVAILABLE_BODY_CLASS = "visualisations-unavailable";
    private static readonly AVAILABLE_VISUALISATION_FACTORIES: VisualisationViewFactory[] = [
        // new IncludegraphicsViewFactory(),
        // new TabularViewFactory(),
        new GridLayoutViewFactory(),
        new MathematicsViewFactory()
    ];

    private messenger: Messenger;

    private visualisationContentContainerNode: HTMLElement;
    private visualisationViews: VisualisationView[];
    private visualisationNamesToViewFactories: Map<string, VisualisationViewFactory>;

    private currentlyDisplayedVisualisationView: VisualisationView | null;
    private currentlyDisplayedVisualisationPopup: VisualisationPopup | null;

    private enableVisualisations: boolean;

    constructor(messenger: Messenger) {
        this.messenger = messenger;

        this.visualisationContentContainerNode = document.createElement("div");
        this.visualisationViews = [];
        this.visualisationNamesToViewFactories = new Map(
            VisualisationViewManager.AVAILABLE_VISUALISATION_FACTORIES
                .map(factory => [factory.visualisationName, factory])
        );

        this.currentlyDisplayedVisualisationView = null;
        this.currentlyDisplayedVisualisationPopup = null;

        this.enableVisualisations = true;

        this.startHandlingVisualisationDisplayRequests();
        this.startHandlingVisualisationContentUpdates();
        this.startHandlingVisualisationStatusUpdate();
    }

    private getVisualisationContentNodeWith(codeMappingId: number): HTMLElement | null {
        return this.visualisationContentContainerNode
                .querySelector(`.visualisation[data-code-mapping-id="${codeMappingId}"]`);
    }

    private displayVisualisation(request: VisualisationDisplayRequest): void {
        // Get the name and the content of the visualisation with the given code mapping ID
        const contentNode = this.getVisualisationContentNodeWith(request.codeMappingId);
        if (!contentNode) {
            console.error(`There is no visualisation content for the given code mapping ID (${request.codeMappingId}).`);
            return;
        }

        const name = contentNode.getAttribute("data-name")!;

        // Make a copy of the content node
        const contentNodeCopy = contentNode.cloneNode(true) as HTMLElement;

        // Create a new view and display it in a popup
        if (!contentNode) {
            console.error(`There is no view factory for the requested visualisation (${name}).`);
            return;
        }

        const factory = this.visualisationNamesToViewFactories.get(name)!;
        const view = factory?.createView(contentNodeCopy, {
            messenger: this.messenger,
            annotationMaskCoordinates: request.annotationMaskCoordinates,
            pdfPageDetail: request.pdfPageDetail
        });

        const popup = new VisualisationPopup(view, request.annotationMaskCoordinates, () => {
            // Reset all the references to the now hidden visualisation
            this.currentlyDisplayedVisualisationView = null;
            this.currentlyDisplayedVisualisationPopup = null;
        });

        this.currentlyDisplayedVisualisationView = view;
        this.currentlyDisplayedVisualisationPopup = popup;
    }

    private hideCurrentlyDisplayedVisualisation(): void {
        if (!this.currentlyDisplayedVisualisationView) {
            return;
        }
        
        this.currentlyDisplayedVisualisationPopup!.close();

        this.currentlyDisplayedVisualisationPopup = null;
        this.currentlyDisplayedVisualisationView = null;
    }

    private handleVisualisationDisplayRequest(request: VisualisationDisplayRequest): void {
        // If visualisations are currently disabled, do not fulfil this request
        if (!this.enableVisualisations) {
            return;
        }

        // Ensure no visualisation is displayed
        this.hideCurrentlyDisplayedVisualisation();

        // Display the view of the visualisation targeted by the request
        this.displayVisualisation(request);
    }  

    private startHandlingVisualisationDisplayRequests(): void {
        window.addEventListener(
            VisualisationViewManager.REQUEST_VISUALISATION_DISPLAY_EVENT,
            (event: Event) => {
                // The event must actually be a custom event
                const customEvent = event as CustomEvent<VisualisationDisplayRequest>;
                this.handleVisualisationDisplayRequest(customEvent.detail);
            }
        );
    }

    private handleOneVisualisationContentUpdate(message: UpdateOneVisualisationMessage): void {
        const uid = message.visualisationUid;

        // Update the content of the visualisation using the HTML provided by the core
        const currentContentNode = this.visualisationContentContainerNode.querySelector(`.visualisation[data-uid="${uid}"]`);
        if (currentContentNode) {
            currentContentNode.outerHTML = message.visualisationContentAsHtml;
        }
        else {
            this.visualisationContentContainerNode.innerHTML += message.visualisationContentAsHtml;
            console.warn(`The content of the updated visualisation (UID ${message.visualisationUid}) has been appended instead of being replaced: it did not exist before.`);
        }
        
        // If the update allows to safely update any visualisation currently on display,
        // check if one is displayed and forward it the message so that it can update itself
        if (message.updateOpenVisualisation && this.currentlyDisplayedVisualisationView) {
            const newContentNode = this.visualisationContentContainerNode
                .querySelector(`.visualisation[data-uid="${uid}"]`) as HTMLElement;

            if (newContentNode) {
                this.currentlyDisplayedVisualisationView.updateWith(newContentNode);
                this.currentlyDisplayedVisualisationPopup!.onAfterDisplayedVisualationContentUpdate();
            }
        }
    }

    private handleAllVisualisationsContentUpdate(message: UpdateAllVisualisationsMessage): void {
        // Update the content of the visualisations using the HTML provided by the core
        this.visualisationContentContainerNode.innerHTML = message.allVisualisationsContentAsHtml;
        
        // If the update allows to safely update any visualisation currently on display,
        // check if one is displayed and forward it the message so that it can update itself
        if (message.updateOpenVisualisation && this.currentlyDisplayedVisualisationView) {
            const codeMappingId = this.currentlyDisplayedVisualisationView.codeMappingId;
            const newContentNode = this.visualisationContentContainerNode
                .querySelector(`.visualisation[data-code-mapping-id="${codeMappingId}"]`) as HTMLElement;

            if (newContentNode) {
                this.currentlyDisplayedVisualisationView.updateWith(newContentNode);
                this.currentlyDisplayedVisualisationPopup!.onAfterDisplayedVisualationContentUpdate();
            }
        }
    }

    private startHandlingVisualisationContentUpdates(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateOneVisualisation,
            (message: UpdateOneVisualisationMessage) => {
                this.handleOneVisualisationContentUpdate(message);
            }
        );

        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateAllVisualisations,
            (message: UpdateAllVisualisationsMessage) => {
                this.handleAllVisualisationsContentUpdate(message);
            }
        );
    }

    private handleOneVisualisationStatusUpdate(message: UpdateOneVisualisationStatusMessage): void {
        // TODO
    }

    private handleAllVisualisationsStatusUpdate(message: UpdateAllVisualisationsStatusMessage): void {
        this.enableVisualisations = message.enableAllVisualisations;
        document.body.classList.toggle(
            VisualisationViewManager.VISUALISATIONS_ARE_UNAVAILABLE_BODY_CLASS,
            !this.enableVisualisations
        );

        // If the visualisations just became unavailable,
        // make sure to close the one currently in display (if any)
        if (!this.enableVisualisations) {
            this.currentlyDisplayedVisualisationPopup?.close();
        }
    }

    private startHandlingVisualisationStatusUpdate(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateOneVisualisationStatusMessage,
            (message: UpdateOneVisualisationStatusMessage) => {
                this.handleOneVisualisationStatusUpdate(message);
            }
        );

        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateAllVisualisationsStatusMessage,
            (message: UpdateAllVisualisationsStatusMessage) => {
                this.handleAllVisualisationsStatusUpdate(message);
            }
        );
    }
}