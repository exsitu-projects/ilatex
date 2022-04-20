import { Messenger } from "../Messenger";
import { WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { TransitionalMetadata, TransitionalModelUID } from "../../shared/transitionals/types";
import { RawSourceFileRange } from "../../shared/source-files/types";
import { TransitionalViewContext } from "./TransitionalViewContext";

export abstract class TransitionalView {
    abstract readonly transitionalName: string;

    readonly context: TransitionalViewContext;
    protected messenger: Messenger;

    protected metadata: TransitionalMetadata;
    protected contentNode: HTMLElement;

    constructor(
        contentNode: HTMLElement,
        metadata: TransitionalMetadata,
        context: TransitionalViewContext
    ) {
        this.context = context;
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

    get modelUid(): TransitionalModelUID {
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
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.metadata.uid,
            title: "reveal-code-in-editor",
            notification: {}
        });
    }

    onBeforeTransitionalDisplay(): void {
        // Do nothing by default
    }

    onAfterTransitionalDisplay(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.metadata.uid,
            title: "view-popup-did-open",
            notification: {}
        });
    }
        
    onBeforeTransitionalErrorDisplay(): void {
        // Do nothing by default
    };

    onAfterTransitionalErrorDisplay(): void {
        // Do nothing by default
    };

    onBeforeTransitionalErrorRemoval(): void {
        // Do nothing by default
    };

    onAfterTransitionalErrorRemoval(): void {
        // Do nothing by default
    };

    onBeforeTransitionalRemoval(): void {
        // Do nothing by default
    }

    onAfterTransitionalRemoval(): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.metadata.uid,
            title: "view-popup-did-close",
            notification: {}
        });
    }

    onBeforePdfResize(): void {
        // Do nothing by default
    }

    onAfterPdfResize(): void {
        // Do nothing by default
    };

    abstract render(): HTMLElement;
    
    abstract updateContentWith(newContentNode: HTMLElement): void;

    updateMetadataWith(newMetadata: TransitionalMetadata): void {
        this.metadata = newMetadata;
    };
}