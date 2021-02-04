// Types of messages which can be exchanged between the core and the webview
export const enum CoreToWebviewMessageType {
    UpdateOneVisualisation = "UpdateOneVisualisation",
    UpdateAllVisualisations = "UpdateAllVisualisations",
    UpdatePDF = "UpdatePDF",
    UpdateCompilationStatus = "UpdateCompilationStatus",
    UpdateVisualisationStatusMessage = "UpdateVisualisationStatusMessage"
}

export const enum WebviewToCoreMessageType {
    NotifyVisualisationModel = "NotifyVisualisationModel",
    SaveAndRecompileRequest = "SaveAndRecompileRequest",
}

export type MessageType =
    CoreToWebviewMessageType | WebviewToCoreMessageType;


// Specification of each type of message which can be sent by the core to the webview
export interface UpdateOneVisualisationMessage {
    type: CoreToWebviewMessageType.UpdateOneVisualisation;
    visualisationUid: number;
    visualisationContentAsHtml: string;
    updateOpenVisualisation: boolean;
}

export interface UpdateAllVisualisationsMessage {
    type: CoreToWebviewMessageType.UpdateAllVisualisations;
    allVisualisationsContentAsHtml: string;
    updateOpenVisualisation: boolean;
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

export interface UpdateOneVisualisationStatusMessage {
    type: CoreToWebviewMessageType.UpdateVisualisationStatusMessage;
    visualisationUid: number;
    visualisationIsAvailable: boolean;
}

export interface UpdateAllVisualisationStatusMessage {
    type: CoreToWebviewMessageType.UpdateVisualisationStatusMessage;
    enableAllVisualisations: boolean;
}

export type CoreToWebviewMessage =
    | UpdateOneVisualisationMessage
    | UpdateAllVisualisationsMessage
    | UpdatePDFMessage
    | UpdateCompilationStatusMessage
    | UpdateOneVisualisationStatusMessage
    | UpdateAllVisualisationStatusMessage;


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
