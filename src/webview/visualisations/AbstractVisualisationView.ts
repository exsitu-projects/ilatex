import { VisualisationView, CodeRange, VisualisationViewInstantiationContext } from "./VisualisationView";
import { Messenger } from "../Messenger";
import { WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";

// Helper function to extract a location (in the LaTeX document) from a HTML attribute
function parseLocationFromAttribute(attributeValue: string) {
    const [_, line, column] = /(\d+);(\d+)/.exec(attributeValue)!;
    return {
        line: Number(line) - 1,
        column: Number(column) - 1
    };
}

export abstract class AbstractVisualisationView implements VisualisationView {
    protected instanciationContext: VisualisationViewInstantiationContext;
    protected messenger: Messenger;

    abstract readonly visualisationName: string;
    protected visualisationId: number;
    readonly sourceIndex: number;

    protected contentNode: HTMLElement;
    readonly contentTitle: string;
    readonly sourceCodeRange: CodeRange;

    constructor(contentNode: HTMLElement, context: VisualisationViewInstantiationContext) {
        this.instanciationContext = context;
        this.messenger = context.messenger;

        this.visualisationId = AbstractVisualisationView.extractVisualisationIdFrom(contentNode);
        this.sourceIndex = AbstractVisualisationView.extractSourceIndexFrom(contentNode);

        this.contentNode = contentNode;
        this.contentTitle = contentNode.getAttribute("data-name")!;
        this.sourceCodeRange =
            AbstractVisualisationView.extractSourceCodeRangeFromContentNode(contentNode);
    }

    abstract render(): HTMLElement;
    
    updateWith(newContentNode: HTMLElement): void {
        // Update the ID of the visualisation
        // (which changes which each update from the model)
        this.visualisationId = AbstractVisualisationView.extractVisualisationIdFrom(newContentNode);
    };

    revealInSourceDocument(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "reveal-code",
            notification: {}
        });
    }

    onBeforeVisualisationDisplay(): void {
        // Do nothing by default
    }

    onAfterVisualisationDisplay(): void {
        // Do nothing by default
    }

    onBeforeVisualisationUpdate(): void {
        // Do nothing by default
    }

    onAfterVisualisationUpdate(): void {
        // Do nothing by default
    }

    onBeforeVisualisationDisappearance(): void {
        // Do nothing by default
    }

    onAfterVisualisationDisappearance(): void {
        // Do nothing by default
    }

    static extractVisualisationIdFrom(contentNode: HTMLElement): number {
        return parseInt(contentNode.getAttribute("data-id")!);
    }

    static extractSourceIndexFrom(contentNode: HTMLElement): number {
        return parseInt(contentNode.getAttribute("data-source-index")!);
    }

    static extractSourceCodeRangeFromContentNode(contentNode: HTMLElement): CodeRange {
        return {
            start: parseLocationFromAttribute(contentNode.getAttribute("data-code-start-position")!),
            end: parseLocationFromAttribute(contentNode.getAttribute("data-code-end-position")!)
        };
    }
}