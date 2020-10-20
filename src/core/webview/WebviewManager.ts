import * as vscode from 'vscode';
import { MessageHandler } from '../../shared/messenger/AbstractMessenger';
import { CoreToWebviewMessageType, WebviewToCoreMessage, WebviewToCoreMessageType } from '../../shared/messenger/messages';
import { FileReader } from '../utils/FileReader';
import { WebviewMessenger } from './WebviewMessenger';


export class WebviewManager {
    private webview: vscode.Webview;
    private messenger: WebviewMessenger;

    constructor(webview: vscode.Webview) {
        this.webview = webview;
        
        this.messenger = new WebviewMessenger(webview);
        this.messenger.startHandlingMessages();
        
        this.setInitialWebviewHtml();
    }

    private setInitialWebviewHtml(): void {
        const inlinedWebviewHtmlFile = FileReader.readExtensionFile("./out/webview/webview.inlined.html");
        this.webview.html = inlinedWebviewHtmlFile.content;
    }

    setHandlerFor(type: WebviewToCoreMessageType, handler: MessageHandler<WebviewToCoreMessage>) {
        this.messenger.setHandlerFor(type, handler);
    }

    unsetHandlerFor(type: WebviewToCoreMessageType) {
        this.messenger.unsetHandlerFor(type);
    }

    adaptURI(uri: vscode.Uri): vscode.Uri {
        return this.webview.asWebviewUri(uri);
    }

    updateVisualisationViewContent(newContent: string, requestedByVisualisation: boolean = false): void {
        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateVisualisations,
            newVisualisationsAsHtml: newContent,
            requestedByVisualisation: requestedByVisualisation
        });
    }

    updatePDF(pdfUri: vscode.Uri): void {
        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdatePDF,
            pdfUri: this.adaptURI(pdfUri).toString()
        });
    }
}