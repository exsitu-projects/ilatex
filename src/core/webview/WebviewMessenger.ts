import * as vscode from "vscode";

import { AbstractMessenger } from "../../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessageType, WebviewToCoreMessageType, CoreToWebviewMessage } from "../../shared/messenger/messages";

export class WebviewMessenger extends AbstractMessenger<
    CoreToWebviewMessageType,
    WebviewToCoreMessageType
>{
    private readonly webview: vscode.Webview;
    private messageHandlerDisposable: vscode.Disposable | null;

    constructor(webview: vscode.Webview) {
        super();

        this.webview = webview;
        this.messageHandlerDisposable = null;
    }

    startHandlingMessages(): void {
        this.messageHandlerDisposable = this.webview.onDidReceiveMessage(message => {
            this.handleMessage(message);
        });
    }

    stopHandlingMessages(): void {
        this.messageHandlerDisposable?.dispose();
    }

    sendMessage(message: CoreToWebviewMessage): void {
        this.webview.postMessage(message);
    }

}