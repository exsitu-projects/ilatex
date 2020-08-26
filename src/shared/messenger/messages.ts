// Types of messages which can be exchanged between the core and the webview
export const enum CoreToWebviewMessageType {
    UpdateVisualisations = "UpdateVisualisations",
    UpdatePDF = "UpdatePDF",
}

export const enum WebviewToCoreMessageType {
    SaveDocument = "SaveDocument",
    NotifyVisualisation = "NotifyVisualisation"
}

export type MessageType = CoreToWebviewMessageType | WebviewToCoreMessageType;


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

export type CoreToWebviewMessage = UpdateVisualisationsMessage | UpdatePDFMessage;


// From webview to extension
export interface SaveDocumentMessage {
    type: WebviewToCoreMessageType.SaveDocument;
};

export interface NotifyVisualisationMessage {
    type: WebviewToCoreMessageType.NotifyVisualisation;
};

export type WebviewToCoreMessage = SaveDocumentMessage | NotifyVisualisationMessage;


// Generic type of a message exchanged between the core and the webview
export type Message = CoreToWebviewMessage | WebviewToCoreMessage;


// Generic type of all messages which match the given message type constraint
// (e.g. when T = CoreToWebviewMessageType, it matches all messages which can be sent by the core)
export type MessagesOfType<T extends MessageType> = Extract<Message, { type: T; }>;
