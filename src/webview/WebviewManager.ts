import * as vscode from 'vscode';
import { WebviewMessage, WebviewMessageType, SelectTextMessage } from './WebviewMessage';
import { FileReader } from '../utils/FileReader';

export type MessageHandler<T extends WebviewMessageType = WebviewMessageType> =
    (messsage: WebviewMessage<T>) => void;

export class WebviewManager {
    // Paths for the template, the styles and the scripts to use in the webview
    // must be relative to the root directory of the extension
    private static readonly WEBVIEW_TEMPLATE_PATH = "./webview/templates/pdf-template.html";
    private static readonly WEBVIEW_STYLES_PATHS = [
        "./webview/styles/lib/ag-grid.css",
        "./webview/styles/lib/ag-theme-balham.css",

        "./webview/styles/main.css",
        "./webview/styles/includegraphics.css",
        "./webview/styles/tabular.css"
    ];
    private static readonly WEBVIEW_SCRIPT_PATHS = [
        "./webview/scripts/lib/ag-grid-community.min.noStyle.js",
        "./webview/scripts/lib/pdf.js",

        "./webview/scripts/main.js",
        "./webview/scripts/display-pdf.js",
        "./webview/scripts/includegraphics.js",
        "./webview/scripts/tabular.js"
    ];

    private readonly panel: vscode.WebviewPanel;
    private readonly webview: vscode.Webview;
    private template: string;
    private templateAroundContent: {before: string, after: string};
    readonly messageHandlers: Map<WebviewMessageType, MessageHandler>;
    private messageHandlerDisposable: vscode.Disposable | null;

    constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.webview = panel.webview;
        this.template = "";
        this.templateAroundContent = {before: "", after: ""};
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
        // Read all the files to inject into the template
        const styleFileRecords = FileReader.readExtensionFiles(WebviewManager.WEBVIEW_STYLES_PATHS);

        // Wrap the styles with <style> tags and inject them into the template
        const stylesAsHTML = styleFileRecords
            .map(fileRecord =>
                `
                    <!-- ${fileRecord.filename} -->
                    <style rel="stylesheet">
                        ${fileRecord.content}
                    </style>
                `
            )
            .join("\n");
        
        this.template = this.template.replace("<!--[STYLES]-->", stylesAsHTML);
    }

    private addScriptsToWebviewTemplate(): void {
        // Read all the files to inject into the template
        const scriptFileRecords = FileReader.readExtensionFiles(WebviewManager.WEBVIEW_SCRIPT_PATHS);

        // Wrap the scripts with <script> tags and inject them into the template
        const scriptsAsHTML = scriptFileRecords
            .map(fileRecord =>
                `
                    <!-- ${fileRecord.filename} -->
                    <script type="text/javascript">
                        ${fileRecord.content}
                    </script>
                `
            )
            .join("\n");
        
        this.template = this.template.replace("<!--[SCRIPTS]-->", scriptsAsHTML);
    }

    private prepareWebviewTemplate(): void {
        // Load the template
        this.template = FileReader.readExtensionFile(WebviewManager.WEBVIEW_TEMPLATE_PATH).content;

        // Add 'external' styles and scripts to the template
        this.addStylesToWebviewTemplate();
        this.addScriptsToWebviewTemplate();

        // Split the template before and after the content injection site
        const contentTag = "<!--[CONTENT]-->";
        const contentTagIndex = this.template.indexOf(contentTag);
        this.templateAroundContent = {
            before: this.template.substr(0, contentTagIndex),
            after: this.template.substr(contentTagIndex + contentTag.length)
        };
    }

    updateWebviewWith(content: string): void {
        this.webview.html = `${this.templateAroundContent.before}${content}${this.templateAroundContent.after}`;
    }
}