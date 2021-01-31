import * as vscode from "vscode";
import { MessageHandler } from "../../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessageType, NotifyVisualisationModelMessage, WebviewToCoreMessage, WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { ExtensionFileReader } from "../utils/FileReader";
import { ModelUID } from "../visualisations/VisualisationModel";
import { WebviewMessenger } from "./WebviewMessenger";


export class WebviewManager {
    private ilatex: InteractiveLatex;
    private webviewPanel: vscode.WebviewPanel;
    private webview: vscode.Webview;
    private messenger: WebviewMessenger;

    private webviewPanelStateChangeObserver: vscode.Disposable | null;

    constructor(ilatex: InteractiveLatex, webviewPanel: vscode.WebviewPanel) {
        this.ilatex = ilatex;
        this.webviewPanel = webviewPanel;
        this.webview = webviewPanel.webview;

        this.messenger = new WebviewMessenger(this.webview);
        this.initWebviewMessageHandlers();
        this.messenger.startHandlingMessages();

        this.webviewPanelStateChangeObserver = null;
        this.startObservingWebviewPanelStateChanges();
        
        this.setInitialWebviewHtml();
    }

    dispose(): void {
        this.messenger.stopHandlingMessages();
        this.stopObservingWebviewPanelStateChanges();
    }

    revealWebviewPanel(): void {
        // By default, the webview panel is displayed in the second column
        this.webviewPanel.reveal(vscode.ViewColumn.Two);
    }

    private initWebviewMessageHandlers(): void {
        // Dispatch a webview notification to the right visualisation.
        // Since notification handlers can perform asynchronous operations,
        // notification message are queued and dispatched one after the other.
        const notificationDispatchQueuer = new TaskQueuer();

        this.setHandlerFor(
            WebviewToCoreMessageType.NotifyVisualisationModel,
            async (message) => {
                notificationDispatchQueuer.add(async () => {
                    await this.ilatex.visualisationModelManager.dispatchNotification(
                        message as NotifyVisualisationModelMessage
                    );
                });
            }
        );

        this.setHandlerFor(
            WebviewToCoreMessageType.SaveAndRecompileRequest,
            async (message) => {
                await this.ilatex.codeMappingManager.saveAllSourceFiles();

                // If the PDF is not already being compiled, rebuild it once the files have been saved
                if (!this.ilatex.pdfManager.isBuildingPDF) {
                    await this.ilatex.pdfManager.buildPDFAndUpdateWebview();
                }

            }
        );
    }

    private startObservingWebviewPanelStateChanges(): void {
        let webviewWasVisible = false;
        this.webviewPanelStateChangeObserver = this.webviewPanel.onDidChangeViewState(event => {
            // If the webview panel becomes visible again,
            // force update the PDF and the visualisations
            // This is required to ensure the webview content is up-to-date
            // because VSCode does not enable hidden webviews to handle messages
            // (see retainContextWhenHidden in
            // https://code.visualstudio.com/api/references/vscode-api#WebviewPanelOptions)
            if (!webviewWasVisible
            &&  event.webviewPanel.visible) {
                this.ilatex.pdfManager.updateWebviewPDF();
                this.ilatex.visualisationModelManager.updateAllWebviewVisualisations();
            }
            
            webviewWasVisible = event.webviewPanel.visible;
        });
    }

    private stopObservingWebviewPanelStateChanges(): void {
        this.webviewPanelStateChangeObserver?.dispose();
    }

    private setInitialWebviewHtml(): void {
        const inlinedWebviewHtmlFile = ExtensionFileReader.readExtensionFile("./out/webview/webview.inlined.html");
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

    sendNewContentForOneVisualisation(
        visualisationUid: ModelUID,
        newContent: string,
        updateOpenVisualisation: boolean = true
    ): void {
        console.info("About to send new content for all visualisations to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateOneVisualisation,
            visualisationUid: visualisationUid,
            visualisationContentAsHtml: newContent,
            updateOpenVisualisation: updateOpenVisualisation
        });
    }

    sendNewContentForAllVisualisations(
        newContent: string,
        updateOpenVisualisation: boolean = false
    ): void {
        console.info("About to send new content for all visualisations to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateAllVisualisations,
            allVisualisationsContentAsHtml: newContent,
            updateOpenVisualisation: updateOpenVisualisation
        });
    }

    sendNewPDF(pdfUri: vscode.Uri): void {
        console.info("About to send a new PDF to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdatePDF,
            pdfUri: this.adaptURI(pdfUri).toString()
        });
    }

    sendNewPDFCompilationStatus(pdfIsCurrentylCompiled: boolean, lastCompilationFailed: boolean = false): void {
        console.info("About to send a new PDF compilation status to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateCompilationStatus,
            pdfIsCurrentlyCompiled: pdfIsCurrentylCompiled,
            lastCompilationFailed: lastCompilationFailed
        });        
    }

    sendNewVisualisationStatus(enableVisualisations: boolean): void {
        console.info("About to send a new visualisation status to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateVisualisationStatusMessage,
            enableVisualisations: enableVisualisations
        });        
    }
}