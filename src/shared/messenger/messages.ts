import { VisualisationMetadata } from "../visualisations/types";

// Types of messages which can be exchanged between the core and the webview
export const enum CoreToWebviewMessageType {
    UpdateVisualisationContent = "UpdateVisualisationContent",
    UpdateVisualisationMetadata = "UpdateVisualisationMetadata",
    UpdatePDF = "UpdatePDF",
    UpdateCompilationStatus = "UpdateCompilationStatus",
    UpdateGlobalOptions = "UpdateGlobalOptions"
}

export const enum WebviewToCoreMessageType {
    NotifyVisualisationModel = "NotifyVisualisationModel",
    SaveAndRecompileRequest = "SaveAndRecompileRequest",
}

export type MessageType =
    CoreToWebviewMessageType | WebviewToCoreMessageType;


// Specification of each type of message which can be sent by the core to the webview
export interface UpdateVisualisationContentMessage {
    type: CoreToWebviewMessageType.UpdateVisualisationContent;
    codeMappingId: number;
    contentAsHtml: string;
}

export interface UpdateVisualisationMetadataMessage {
    type: CoreToWebviewMessageType.UpdateVisualisationMetadata;
    codeMappingId: number;
    metadata: VisualisationMetadata;
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
        enableVisualisations: boolean;
    }
}

export type CoreToWebviewMessage =
    | UpdateVisualisationContentMessage
    | UpdateVisualisationMetadataMessage
    | UpdatePDFMessage
    | UpdateCompilationStatusMessage
    | UpdateGlobalOptionsMessage;


// Specification of each type of message which can be sent by the webview to the core
export interface NotifyVisualisationModelMessage {
    type: WebviewToCoreMessageType.NotifyVisualisationModel;
    visualisationUid: number;
    title: string;
    notification: object;
};

export interface SaveAndRecompileRequestMessage {
    type: WebviewToCoreMessageType.SaveAndRecompileRequest;
}

export type WebviewToCoreMessage =
    NotifyVisualisationModelMessage | SaveAndRecompileRequestMessage;


// Generic type of a message exchanged between the core and the webview
export type Message =
    CoreToWebviewMessage | WebviewToCoreMessage;


// Generic type of all messages which match the given message type constraint
// (e.g. when T = CoreToWebviewMessageType, it matches all messages which can be sent by the core)
export type MessagesOfType<T extends MessageType> = Extract<Message, { type: T; }>;
