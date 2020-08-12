import * as vscode from 'vscode';
import { WebviewMessage, WebviewMessageType, UpdateVisualisationsMessage, UpdatePDFMessage } from './WebviewMessage';
import { FileReader } from '../utils/FileReader';

export type MessageHandler<T extends WebviewMessageType = WebviewMessageType> =
    (messsage: WebviewMessage<T>) => void;

export class WebviewManager {
    // Paths for the template, the styles and the scripts to use in the webview
    // must be relative to the root directory of the extension
    private static readonly WEBVIEW_TEMPLATE_PATH = "./webview/templates/main-template.html";
    private static readonly WEBVIEW_STYLES_PATHS = [
        "./webview/styles/lib/ag-grid.css",
        "./webview/styles/lib/ag-theme-balham.css",

        "./webview/styles/main.css",
        "./webview/styles/display-pdf.css",
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

    private readonly webview: vscode.Webview;
    private template: string;
    readonly messageHandlers: Map<WebviewMessageType, MessageHandler>;
    private messageHandlerDisposable: vscode.Disposable | null;

    constructor(webview: vscode.Webview) {
        this.webview = webview;
        this.template = "";
        this.messageHandlers = new Map();
        this.messageHandlerDisposable = null;

        this.init();
    }

    private init() {
        this.startHandlingMessages();
        
        this.prepareWebviewTemplate();
        this.webview.html = this.template;
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
    }

    updateWebviewVisualisations(visualisationsHtml: string) {
        this.sendMessage({
            type: WebviewMessageType.UpdateVisualisations,
            with: visualisationsHtml
        } as UpdateVisualisationsMessage);
    }

    updateWebviewPDF(pdfUri: vscode.Uri) {
        this.sendMessage({
            type: WebviewMessageType.UpdatePDF,
            uri: this.adaptURI(pdfUri).toString()
        } as UpdatePDFMessage);
    }
}