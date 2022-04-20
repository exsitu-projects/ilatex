import { TransitionalMetadata } from "../transitionals/types";

// Types of messages which can be exchanged between the core and the webview
export const enum CoreToWebviewMessageType {
    UpdateTransitionalContent = "UpdateTransitionalContent",
    UpdateTransitionalMetadata = "UpdateTransitionalMetadata",
    UpdatePDF = "UpdatePDF",
    UpdateCompilationStatus = "UpdateCompilationStatus",
    UpdateGlobalOptions = "UpdateGlobalOptions"
}

export const enum WebviewToCoreMessageType {
    NotifyTransitionalModel = "NotifyTransitionalModel",
    SaveAndRecompileRequest = "SaveAndRecompileRequest",
}

export type MessageType =
    CoreToWebviewMessageType | WebviewToCoreMessageType;


// Specification of each type of message which can be sent by the core to the webview
export interface UpdateTransitionalContentMessage {
    type: CoreToWebviewMessageType.UpdateTransitionalContent;
    codeMappingId: number;
    contentAsHtml: string;
}

export interface UpdateTransitionalMetadataMessage {
    type: CoreToWebviewMessageType.UpdateTransitionalMetadata;
    codeMappingId: number;
    metadata: TransitionalMetadata;
}

export interface UpdatePDFMessage {
    type: CoreToWebviewMessageType.UpdatePDF;
    pdfUri: string;
}

export interface UpdateCompilationStatusMessage {
    type: CoreToWebviewMessageType.UpdateCompilationStatus;
    pdfIsCurrentlyCompiled: boolean;
    lastCompilationFailed: boolean;
}

export interface UpdateGlobalOptionsMessage {
    type: CoreToWebviewMessageType.UpdateGlobalOptions;
    options: {
        enableTransitionals: boolean;
    }
}

export type CoreToWebviewMessage =
    | UpdateTransitionalContentMessage
    | UpdateTransitionalMetadataMessage
    | UpdatePDFMessage
    | UpdateCompilationStatusMessage
    | UpdateGlobalOptionsMessage;


// Specification of each type of message which can be sent by the webview to the core
export interface NotifyTransitionalModelMessage {
    type: WebviewToCoreMessageType.NotifyTransitionalModel;
    transitionalUid: number;
    title: string;
    notification: object;
};

export interface SaveAndRecompileRequestMessage {
    type: WebviewToCoreMessageType.SaveAndRecompileRequest;
}

export type WebviewToCoreMessage =
    NotifyTransitionalModelMessage | SaveAndRecompileRequestMessage;


// Generic type of a message exchanged between the core and the webview
export type Message =
    CoreToWebviewMessage | WebviewToCoreMessage;


// Generic type of all messages which match the given message type constraint
// (e.g. when T = CoreToWebviewMessageType, it matches all messages which can be sent by the core)
export type MessagesOfType<T extends MessageType> = Extract<Message, { type: T; }>;
