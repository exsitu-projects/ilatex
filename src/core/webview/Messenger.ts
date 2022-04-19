import * as vscode from "vscode";

import { AbstractMessenger } from "../../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessageType, WebviewToCoreMessageType, CoreToWebviewMessage } from "../../shared/messenger/messages";

export class Messenger extends AbstractMessenger<
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
        this.messageHandlerDisposable = null;
    }

    async sendMessage(message: CoreToWebviewMessage): Promise<void> {
        await this.webview.postMessage(message);
    }

}