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
    private lastKnownUid: number;
    readonly codeMappingId: number;

    protected contentNode: HTMLElement;
    readonly contentTitle: string;
    readonly sourceFileName: string;
    readonly sourceCodeRange: CodeRange;

    constructor(contentNode: HTMLElement, context: VisualisationViewInstantiationContext) {
        this.instanciationContext = context;
        this.messenger = context.messenger;

        this.lastKnownUid = AbstractVisualisationView.extractVisualisationUidFrom(contentNode);
        this.codeMappingId = AbstractVisualisationView.extractCodeMappingIdFrom(contentNode);

        this.contentNode = contentNode;
        this.contentTitle = contentNode.getAttribute("data-name")!;
        this.sourceFileName = contentNode.getAttribute("data-source-file-name")!;
        this.sourceCodeRange =
            AbstractVisualisationView.extractSourceCodeRangeFromContentNode(contentNode);
    }

    get visualisationUid(): number {
        return this.lastKnownUid;
    }

    saveSourceDocument(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.visualisationUid,
            title: "save-source-document",
            notification: {}
        });
    }

    revealInSourceDocument(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.visualisationUid,
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

    abstract render(): HTMLElement;
    
    updateWith(newContentNode: HTMLElement): void {
        // Update the UID of the visualisation (which changes which each update from the model)
        this.lastKnownUid = AbstractVisualisationView.extractVisualisationUidFrom(newContentNode);
    };


    static extractVisualisationUidFrom(contentNode: HTMLElement): number {
        return parseInt(contentNode.getAttribute("data-uid")!);
    }

    static extractCodeMappingIdFrom(contentNode: HTMLElement): number {
        return parseInt(contentNode.getAttribute("data-code-mapping-id")!);
    }

    static extractSourceCodeRangeFromContentNode(contentNode: HTMLElement): CodeRange {
        return {
            start: parseLocationFromAttribute(contentNode.getAttribute("data-code-start-position")!),
            end: parseLocationFromAttribute(contentNode.getAttribute("data-code-end-position")!)
        };
    }
}