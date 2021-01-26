import { Messenger } from "../Messenger";
import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";

export interface CodeRange {
    start: {line: number, column: number};
    end: {line: number, column: number};
}

export interface VisualisationViewInstantiationContext {
    messenger: Messenger;
    annotationMaskCoordinates: AnnotationMaskCoordinates;
    pdfPageDetail: {
        pageNumber: number;
        width: number;
        height: number;
        scale: number;
    }
}

export interface VisualisationView {
    readonly visualisationName: string;
    readonly visualisationUid: number;
    readonly codeMappingId: number;
    readonly contentTitle: string;
    readonly sourceFileName: string;
    readonly sourceCodeRange: CodeRange;

    render(): HTMLElement;
    updateWith(newContentNode: HTMLElement): void;

    saveSourceDocument(): void;
    revealInSourceDocument(): void;

    onBeforeVisualisationDisplay(): void;
    onAfterVisualisationDisplay(): void;
    
    onBeforeVisualisationDisappearance(): void;
    onAfterVisualisationDisappearance(): void;

    revealInSourceDocument(): void;
}

export interface VisualisationViewFactory {
    readonly visualisationName: string;
    createView(contentNode: HTMLElement, context: VisualisationViewInstantiationContext): VisualisationView;
}