import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewMessage, WebviewMessageType, SelectTextMessage } from './WebviewMessage';

export type MessageHandler<T extends WebviewMessageType = WebviewMessageType> =
    (messsage: WebviewMessage<T>) => void;

// Absolute path to the root directory of this extension
// TODO: move elsewhere
const EXTENSION_ROOT_PATH = vscode.extensions.getExtension("exsitu.interactive-latex")!.extensionPath;

// Create a record of file contents indexed by the filenames they were read from
// from an array of paths (relative to the root of the extension)
// TODO: move elsewhere
function readFiles(relativePaths: string[]): Record<string, string> {
    const filenamesToContent: Record<string, string> = {};

    for (let relativePath of relativePaths) {
        // Name of the file
        const lastSlashIndex = relativePath.lastIndexOf("/");
        const filename = relativePath.substr(lastSlashIndex + 1);

        // Content of the file
        const absolutePath = path.resolve(EXTENSION_ROOT_PATH, relativePath);
        const contentFileBuffer = fs.readFileSync(absolutePath);

        filenamesToContent[filename] = contentFileBuffer.toString();
    }

    return filenamesToContent;
}

export class WebviewManager {
    // Paths for the template, the styles and the scripts to use in the webview
    // must be relative to the root directory of the extension
    private static readonly WEBVIEW_TEMPLATE_PATH = "./webview/templates/main-template.html";
    private static readonly WEBVIEW_STYLES_PATHS = [
        "./webview/styles/main.css",
        "./webview/styles/includegraphics.css",
        "./webview/styles/tabular.css"
    ];
    private static readonly WEBVIEW_SCRIPT_PATHS = [
        "./webview/scripts/main.js",
        "./webview/scripts/includegraphics.js",
        "./webview/scripts/tabular.js"
    ];

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

        this.prepareWebviewTemplate();
        this.startHandlingMessages();
    }

    startHandlingMessages(): void {
        this.messageHandlerDisposable = this.webview.onDidReceiveMessage((message) => {
            this.handleMessage(message);
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

    private addStylesToWebviewTemplate(): void {
        // Get all the styles to inject into the template
        const filenamesToStyles = readFiles(WebviewManager.WEBVIEW_STYLES_PATHS);

        // Wrap the styles with <style> tags and inject them into the template
        const stylesAsHTML = Object.entries(filenamesToStyles)
            .map(([filename, css]) => {
                return `
                    <!-- ${filename} -->
                    <style>
                        ${css}
                    </style>
                `;
            })
            .join("\n");
        
        this.template = this.template.replace("<!--[STYLES]-->", stylesAsHTML);
    }

    private addScriptsToWebviewTemplate(): void {
        // Get all the scripts to inject into the template
        const filenamesToScripts = readFiles(WebviewManager.WEBVIEW_SCRIPT_PATHS);

        // Wrap the scripts with <script> tags and inject them into the template
        const scriptsAsHTML = Object.entries(filenamesToScripts)
            .map(([filename, js]) => {
                return `
                    <!-- ${filename} -->
                    <script type="text/javascript">
                        ${js}
                    </script>
                `;
            })
            .join("\n");
        
        this.template = this.template.replace("<!--[SCRIPTS]-->", scriptsAsHTML);
    }

    private prepareWebviewTemplate(): void {
        // Load the template
        this.template  = Object.values(readFiles([WebviewManager.WEBVIEW_TEMPLATE_PATH]))[0];

        // Add 'external' styles and scripts to the template
        this.addStylesToWebviewTemplate();
        this.addScriptsToWebviewTemplate();
    }

    updateWebviewWith(content: string): void {
        this.webview.html = this.template.replace(
            "<!--[CONTENT]-->",
            content
        );
    }
}