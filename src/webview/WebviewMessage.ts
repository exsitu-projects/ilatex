import { VisualisationID } from "../visualisations/Visualisation";

export const enum WebviewMessageType {
    // From extension to webview
    FocusVisualisation = "FocusVisualisation",
    UpdateVisualisations = "UpdateVisualisations",
    UpdatePDF = "UpdatePDF",

    // From webview to extension
    SelectText = "SelectText",
    ReplaceText = "ReplaceText",
    SaveDocument = "SaveDocument"
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
export interface SelectTextMessage extends WebviewMessage<WebviewMessageType.SelectText> {
    from: {lineIndex: number, columnIndex: number};
    to: {lineIndex: number, columnIndex: number};
    scroll?: boolean;
}

export interface ReplaceTextMessage extends WebviewMessage<WebviewMessageType.ReplaceText> {
    from: {lineIndex: number, columnIndex: number};
    to: {lineIndex: number, columnIndex: number};
    with: string;
    saveDocument?: boolean;
}

export interface SaveDocumentMessage extends WebviewMessage<WebviewMessageType.SaveDocument> {};