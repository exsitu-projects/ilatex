import { RawSourceFileRange } from "../../shared/source-files/types";
import { VisualisationMetadata, VisualisationModelUID } from "../../shared/visualisations/types";
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
    readonly name: string;
    readonly title: string;
    readonly modelUid: VisualisationModelUID;
    readonly codeMappingId: number;
    readonly sourceFileName: string;
    readonly sourceFileCodeRange: RawSourceFileRange;

    render(): HTMLElement;

    updateContentWith(newContentNode: HTMLElement): void;
    updateMetadataWith(newMetadata: VisualisationMetadata): void;

    revealInSourceDocument(): void;

    onBeforeVisualisationDisplay(): void;
    onAfterVisualisationDisplay(): void;
    
    onBeforeVisualisationDisappearance(): void;
    onAfterVisualisationDisappearance(): void;

    revealInSourceDocument(): void;
}

export interface VisualisationViewFactory {
    readonly visualisationName: string;
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext): VisualisationView;
}