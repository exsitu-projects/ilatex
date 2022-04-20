import "../../../webview/static-library-apis/katexApi";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { TaskThrottler } from "../../../shared/tasks/TaskThrottler";
import { TransitionalView } from "../../../webview/transitionals/TransitionalView";


export class TemplateTransitionalView extends TransitionalView {
    static readonly transitionalName = "TODO";

    // This property must contain the name of the transitioal this view is designed for.
    // It must correspond to the name used in the model.
    readonly transitionalName = TemplateTransitionalView.transitionalName;

    // Main container of the view
    private viewNode: HTMLElement;

    // Unique event callbacks
    private viewClickCallback =
        (event: MouseEvent) => { this.onViewMouseClick(event); };

    constructor(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext) {
        super(contentNode, metadata, context);

        // When the view is created, (some of) the DOM nodes that compose it can already be created,
        // even though they have not been appended to the DOM yet (see the `render` method).
        this.viewNode = document.createElement("div");
        this.viewNode.classList.add("math-container");

        this.startHandlingEvents();
    }

    // Example of a method that handles a DOM event.
    private onViewMouseClick(event: MouseEvent): void {
        // Handle the event here...
    }

    // Example of a method that adds all the DOM event handlers (to be used when the transitional is displayed in the webview).
    private startHandlingEvents(): void {
        this.viewNode.addEventListener("click", this.viewClickCallback);
    }

    // Example of a method that removes all the DOM event handlers (to be used when the transitional is removed from the webview).
    private stopHandlingEvents(): void {
        this.viewNode.removeEventListener("click", this.viewClickCallback);
    }        

    // This method must return the DOM node that will be displayed inside the transitional popup.
    render(): HTMLElement {
        return this.viewNode;
    }

    // This method should process ad/or update the reference to the new content sent by the model of this transitional.
    // It may perform additional steps as well if needed.
    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;
        
        // TODO: possibly perform additional steps when new content is provided by the model here.
    };

    // Example of a lifetime hook that can be used in a transitional view.
    // This one will be called before the transitional is removed (when the popup is closed),
    // and can be used for tasks such as removing event handlers.
    onBeforeTransitionalRemoval(): void {
        this.stopHandlingEvents();
    }
}
