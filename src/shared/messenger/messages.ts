// Types of messages which can be exchanged between the core and the webview
export const enum CoreToWebviewMessageType {
    UpdateVisualisations = "UpdateVisualisations",
    UpdatePDF = "UpdatePDF",
    UpdateCompilationStatus = "UpdateCompilationStatus"
}

export const enum WebviewToCoreMessageType {
    NotifyVisualisationModel = "NotifyVisualisationModel"
}

export type MessageType =
    CoreToWebviewMessageType | WebviewToCoreMessageType;


// Specification of each type of message which can be sent by the core to the webview
export interface UpdateVisualisationsMessage {
    type: CoreToWebviewMessageType.UpdateVisualisations;
    newVisualisationsAsHtml: string;
    requestedByVisualisation: boolean;
}

export interface UpdatePDFMessage {
    type: CoreToWebviewMessageType.UpdatePDF;
    pdfUri: string;
}

export interface UpdateCompilationStatusMessage {
    type: CoreToWebviewMessageType.UpdateCompilationStatus;
    pdfIsCurrentlyCompiled: boolean;
}

export type CoreToWebviewMessage =
    UpdateVisualisationsMessage | UpdatePDFMessage | UpdateCompilationStatusMessage;


// Specification of each type of message which can be sent by the webview to the core
export interface NotifyVisualisationModelMessage {
    type: WebviewToCoreMessageType.NotifyVisualisationModel;
    visualisationUid: number;
    title: string;
    notification: object;
};

export type WebviewToCoreMessage =
    NotifyVisualisationModelMessage;


// Generic type of a message exchanged between the core and the webview
export type Message =
    CoreToWebviewMessage | WebviewToCoreMessage;


// Generic type of all messages which match the given message type constraint
// (e.g. when T = CoreToWebviewMessageType, it matches all messages which can be sent by the core)
export type MessagesOfType<T extends MessageType> = Extract<Message, { type: T; }>;
