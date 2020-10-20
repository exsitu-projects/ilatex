import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";
import { Messenger } from "../Messenger";
import { VisualisationView, VisualisationViewFactory } from "./VisualisationView";
import { VisualisationPopup } from "./VisualisationPopup";
import { WebviewToCoreMessageType, CoreToWebviewMessageType, UpdateVisualisationsMessage } from "../../shared/messenger/messages";
import IncludegraphicsViewFactory from "../../visualisations/includegraphics/view/view";
import TabularViewFactory from "../../visualisations/tabular/view/view";
import GridLayoutViewFactory from "../../visualisations/gridlayout/view/view";

export interface VisualisationDisplayRequest {
    sourceIndex: number;
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
    private static readonly AVAILABLE_VISUALISATION_FACTORIES: VisualisationViewFactory[] = [
        new IncludegraphicsViewFactory(),
        new TabularViewFactory(),
        new GridLayoutViewFactory()
    ];

    private messenger: Messenger;

    private visualisationContentContainerNode: HTMLElement;
    private visualisationViews: VisualisationView[];
    private visualisationNamesToViewFactories: Map<string, VisualisationViewFactory>;

    private currentlyDisplayedVisualisationView: VisualisationView | null;
    private currentlyDisplayedVisualisationPopup: VisualisationPopup | null;

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

        this.startHandlingVisualisationDisplayRequests();
        this.startHandlingVisualisationContentUpdates();
    }

    private getVisualisationContentNode(sourceIndex: number): HTMLElement | null {
        console.log("Request the content of a visualisation...");
        console.log(this.visualisationContentContainerNode);
        return this.visualisationContentContainerNode
                .querySelector(`.visualisation[data-source-index="${sourceIndex}"]`);
    }

    private displayVisualisation(request: VisualisationDisplayRequest): void {
        // Get the name and the content of the visualisation with the given source index
        const contentNode = this.getVisualisationContentNode(request.sourceIndex);
        if (!contentNode) {
            console.error(`There is no visualisation content for the given source index (${request.sourceIndex}).`);
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
            // Reset all the references to the hidden visualisation 
            this.currentlyDisplayedVisualisationView = null;
            this.currentlyDisplayedVisualisationPopup = null;

            // By default, the document is saved when the popup is closed
            this.messenger.sendMessage({
                type: WebviewToCoreMessageType.SaveDocument
            });
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

    private handleVisualisationContentUpdate(message: UpdateVisualisationsMessage): void {
        // Update the content of the visualisations using the HTML provided by the core
        this.visualisationContentContainerNode.innerHTML = message.newVisualisationsAsHtml;
        
        // If the update was requested by the visualisation which is currenty displayed,
        // ensure it is still displayed and forward it the message (so it can update itself)
        if (this.currentlyDisplayedVisualisationView
        && message.requestedByVisualisation) {
            const sourceIndex = this.currentlyDisplayedVisualisationView.sourceIndex;
            const newContentNode = this.visualisationContentContainerNode
                .querySelector(`.visualisation[data-source-index="${sourceIndex}"]`) as HTMLElement;

            if (newContentNode) {
                this.currentlyDisplayedVisualisationView.updateWith(newContentNode);
                this.currentlyDisplayedVisualisationPopup!.onAfterDisplayedVisualationContentUpdate();
            }
        }
    }

    private startHandlingVisualisationContentUpdates(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateVisualisations,
            (message: UpdateVisualisationsMessage) => {
                this.handleVisualisationContentUpdate(message);
            }
        );
    }
}