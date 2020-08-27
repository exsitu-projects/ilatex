import { Messenger } from "../Messenger";

export interface SourceDocumentLocation {
    start: {line: number, column: number};
    end: {line: number, column: number};
}

export interface VisualisationView {
    readonly visualisationName: string;
    
    readonly sourceIndex: number;
    readonly contentTitle: string;
    readonly contentLocationInSourceDocument: SourceDocumentLocation;

    render(): HTMLElement;
    updateWith(newContentNode: HTMLElement): void;

    onBeforeVisualisationDisplay(): void;
    onAfterVisualisationDisplay(): void;
    
    onBeforeVisualisationDisappearance(): void;
    onAfterVisualisationDisappearance(): void;

    revealInSourceDocument(): void;
}

export interface VisualisationViewFactory {
    readonly visualisationName: string;
    createView(contentNode: HTMLElement, messenger: Messenger): VisualisationView;
}