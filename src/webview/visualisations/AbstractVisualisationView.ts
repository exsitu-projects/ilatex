import { VisualisationView, CodeRange, VisualisationViewInstantiationContext } from "./VisualisationView";
import { Messenger } from "../Messenger";
import { WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";
import { VisualisationMetadata, VisualisationModelUID } from "../../shared/visualisations/types";
import { RawSourceFileRange } from "../../shared/source-files/types";

export abstract class AbstractVisualisationView implements VisualisationView {
    protected instanciationContext: VisualisationViewInstantiationContext;
    protected messenger: Messenger;

    abstract readonly visualisationName: string;

    protected metadata: VisualisationMetadata;
    protected contentNode: HTMLElement;

    constructor(
        contentNode: HTMLElement,
        metadata: VisualisationMetadata,
        context: VisualisationViewInstantiationContext
    ) {
        this.instanciationContext = context;
        this.messenger = context.messenger;

        this.contentNode = contentNode;
        this.metadata = metadata;
    }

    get name(): string {
        return this.metadata.name;
    }

    get title(): string {
        return this.metadata.name;
    }

    get modelUid(): VisualisationModelUID {
        return this.metadata.uid;
    }

    get codeMappingId(): number {
        return this.metadata.codeMappingId;
    }

    get sourceFileName(): string {
        return this.metadata.fileName;
    }

    get sourceFileCodeRange(): RawSourceFileRange {
        return this.metadata.codeRange;
    }

    get isAvailable(): boolean {
        return this.metadata.available;
    }

    revealInSourceDocument(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.metadata.uid,
            title: "reveal-code-in-editor",
            notification: {}
        });
    }

    onBeforeVisualisationDisplay(): void {
        // Do nothing by default
    }

    onAfterVisualisationDisplay(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.metadata.uid,
            title: "view-popup-did-open",
            notification: {}
        });
    }
        
    onBeforeVisualisationErrorDisplay(): void {
        // Do nothing by default
    };

    onAfterVisualisationErrorDisplay(): void {
        // Do nothing by default
    };

    onBeforeVisualisationErrorRemoval(): void {
        // Do nothing by default
    };

    onAfterVisualisationErrorRemoval(): void {
        // Do nothing by default
    };

    onBeforeVisualisationRemoval(): void {
        // Do nothing by default
    }

    onAfterVisualisationRemoval(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.metadata.uid,
            title: "view-popup-did-close",
            notification: {}
        });
    }

    abstract render(): HTMLElement;
    
    abstract updateContentWith(newContentNode: HTMLElement): void;

    updateMetadataWith(newMetadata: VisualisationMetadata): void {
        this.metadata = newMetadata;
    };
}