import { VisualisationView, SourceDocumentLocation } from "./VisualisationView";
import { Messenger } from "../Messenger";
import { WebviewToCoreMessageType } from "../../shared/messenger/messages";

// Helper function to extract a location (in the LaTeX document) from a HTML attribute
function parseLocationFromAttribute(attributeValue: string) {
    const [_, line, column] = /(\d+);(\d+)/.exec(attributeValue)!;
    return {
        line: Number(line) - 1,
        column: Number(column) - 1
    };
}

export abstract class AbstractVisualisationView implements VisualisationView {
    protected messenger: Messenger;

    abstract readonly visualisationName: string;
    protected readonly visualisationId: number;
    readonly sourceIndex: number;

    protected contentNode: HTMLElement;
    readonly contentTitle: string;
    readonly contentLocationInSourceDocument: SourceDocumentLocation;

    constructor(contentNode: HTMLElement, messenger: Messenger) {
        this.messenger = messenger;

        this.visualisationId = parseInt(contentNode.getAttribute("data-id")!);
        this.sourceIndex = parseInt(contentNode.getAttribute("data-source-index")!);

        this.contentNode = contentNode;
        this.contentTitle = contentNode.getAttribute("data-name")!;
        this.contentLocationInSourceDocument =
            AbstractVisualisationView.extractContentLocationFromContentNode(contentNode);
    }

    abstract render(): HTMLElement;
    abstract updateWith(newContentNode: HTMLElement): void;

    revealInSourceDocument(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.RevealVisualisedSources,
            visualisationId: this.visualisationId
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

    static extractContentLocationFromContentNode(contentNode: HTMLElement): SourceDocumentLocation {
        return {
            start: parseLocationFromAttribute(contentNode.getAttribute("data-loc-start")!),
            end: parseLocationFromAttribute(contentNode.getAttribute("data-loc-end")!)
        };
    }
}