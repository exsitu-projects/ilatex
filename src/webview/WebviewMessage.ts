import { VisualisationID } from "../visualisations/Visualisation";

export const enum WebviewMessageType {
    // From extension to webview
    FocusVisualisation = "FocusVisualisation",
    UpdateVisualisations = "UpdateVisualisations",
    UpdatePDF = "UpdatePDF",

    // From webview to extension
    SaveDocument = "SaveDocument",
    NotifyVisualisation = "NotifyVisualisation"
}

export interface WebviewMessage<T extends WebviewMessageType = WebviewMessageType> {
    type: T;
}


// From extension to webview
export interface FocusVisualisationMessage extends WebviewMessage<WebviewMessageType.FocusVisualisation> {
    id: VisualisationID;
}

export interface UpdateVisualisationsMessage extends WebviewMessage<WebviewMessageType.UpdateVisualisations> {
    with: string;
}

export interface UpdatePDFMessage extends WebviewMessage<WebviewMessageType.UpdatePDF> {
    uri: string;
}


// From webview to extension
export interface SaveDocumentMessage extends WebviewMessage<WebviewMessageType.SaveDocument> {};

export interface NotifyVisualisationMessage extends WebviewMessage<WebviewMessageType.NotifyVisualisation> {
    id: VisualisationID;
    sourceIndex: number;
    subject: string;
    payload?: object;
};