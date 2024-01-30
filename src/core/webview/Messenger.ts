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
        // The postMessage method returns a promise that should normally be awaited.
        // Yet, i-LaTeX seems to be in a situation in which VS Code never resolves it,
        // as noted in https://github.com/microsoft/vscode/issues/159431.
        // For this reason, it currently cannot be awaited; otherwise, it causes
        // task runners awaiting for the promise to resolve to never run future tasks.
        this.webview.postMessage(message);
    }

}