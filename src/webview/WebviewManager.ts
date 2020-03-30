import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewMessage, WebviewMessageType, SelectTextMessage } from './WebviewMessage';

export type MessageHandler<T extends WebviewMessageType = WebviewMessageType> =
    (messsage: WebviewMessage<T>) => void;

export class WebviewManager {
    // The path must be relative to the root directory of the extension
    private static readonly WEBVIEW_TEMPLATE_PATH = "./templates/webview.html";
    // private static readonly WEBVIEW_TEMPLATE_PATH = "./templates/frame.html";

    private readonly panel: vscode.WebviewPanel;
    private readonly webview: vscode.Webview;
    private template: string;
    readonly messageHandlers: Map<WebviewMessageType, MessageHandler>;
    private messageHandlerDisposable: vscode.Disposable | null;

    constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.webview = panel.webview;
        this.template = "";
        this.messageHandlers = new Map();
        this.messageHandlerDisposable = null;

        this.loadWebviewTemplate();
        this.startHandlingMessages();
    }

    startHandlingMessages(): void {
        this.messageHandlerDisposable = this.webview.onDidReceiveMessage((message) => {
            try {
                this.handleMessage(message);
            }
            catch (error) {
                console.error(error);
            }
        });
    }

    stopHandlingMessages(): void {
        this.messageHandlerDisposable?.dispose();
    }

    handleMessage(message: WebviewMessage): void {
        console.log("Received message:", message);

        if (! (message && this.messageHandlers.has(message?.type))) {
            console.error("iLatex is unable to handle the following message:", message);
            return;
        }

        const handler = this.messageHandlers.get(message.type) as MessageHandler;
        handler(message);
    }

    sendMessage(message: WebviewMessage): void {
        this.webview.postMessage(message);
    }

    setHandlerFor(type: WebviewMessageType, handler: MessageHandler) {
        this.messageHandlers.set(type, handler);
    }

    unsetHandlerFor(type: WebviewMessageType) {
        this.messageHandlers.delete(type);
    }

    adaptURI(uri: vscode.Uri): vscode.Uri {
        return this.webview.asWebviewUri(uri);
    }

    private loadWebviewTemplate(): void {
        const thisExtension = vscode.extensions.getExtension("exsitu.interactive-latex");
        if (thisExtension !== undefined) {
            const extensionDirectoryPath = thisExtension.extensionPath;
            const templatePath = path.resolve(
                extensionDirectoryPath,
                WebviewManager.WEBVIEW_TEMPLATE_PATH
            );

            const templateFileBuffer = fs.readFileSync(templatePath);
            this.template = templateFileBuffer.toString();
        }
    }

    updateWebviewWith(content: string): void {
        this.webview.html = this.template.replace(
            "<!--CONTENT-->",
            content
        );
    }
}