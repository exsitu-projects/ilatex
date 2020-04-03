import { VisualisationID } from "../visualisations/Visualisation";

export const enum WebviewMessageType {
    // From extension to webview
    FocusVisualisation = "FocusVisualisation",

    // From webview to extension
    SelectText = "SelectText",
    ReplaceText = "ReplaceText"
}

export interface WebviewMessage<T extends WebviewMessageType = WebviewMessageType> {
    type: T;
}

export interface SelectTextMessage extends WebviewMessage<WebviewMessageType.SelectText> {
    from: {lineIndex: number, columnIndex: number}
    to: {lineIndex: number, columnIndex: number};
}

export interface ReplaceTextMessage extends WebviewMessage<WebviewMessageType.ReplaceText> {
    from: {lineIndex: number, columnIndex: number}
    to: {lineIndex: number, columnIndex: number};
    with: string;
    reload?: boolean;
}

export interface FocusVisualisationMessage extends WebviewMessage<WebviewMessageType.FocusVisualisation> {
    id: VisualisationID;
}