import * as vscode from "vscode";
import { MessageHandler } from "../../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessageType, NotifyVisualisationModelMessage, WebviewToCoreMessage, WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { ExtensionFileReader } from "../utils/FileReader";
import { VisualisationModel } from "../visualisations/VisualisationModel";
import { WebviewMessenger } from "./WebviewMessenger";


export class WebviewManager {
    private ilatex: InteractiveLatex;

    private webviewPanel: vscode.WebviewPanel;
    private webview: vscode.Webview;
    private messenger: WebviewMessenger;

    private webviewPanelStateChangeObserverDisposable: vscode.Disposable;

    constructor(ilatex: InteractiveLatex, webviewPanel: vscode.WebviewPanel) {
        this.ilatex = ilatex;
        this.webviewPanel = webviewPanel;
        this.webview = webviewPanel.webview;

        this.messenger = new WebviewMessenger(this.webview);
        this.messenger.startHandlingMessages();

        this.webviewPanelStateChangeObserverDisposable = this.webviewPanel.onDidChangeViewState(event => {
            // If the webview panel becomes visible again, force update the PDF and the visualisations.
            // This is required to ensure the webview content is up-to-date
            // because VSCode does not enable hidden webviews to handle messages
            // (see retainContextWhenHidden in https://code.visualstudio.com/api/references/vscode-api#WebviewPanelOptions).
            if (event.webviewPanel.visible) {
                this.sendNewPDF();
                this.sendNewContentForAllVisualisations();
            };
        });
        
        this.initWebviewMessageHandlers();
        this.setInitialWebviewHtml();
    }

    private setHandlerFor(type: WebviewToCoreMessageType, handler: MessageHandler<WebviewToCoreMessage>) {
        this.messenger.setHandlerFor(type, handler);
    }

    private unsetHandlerFor(type: WebviewToCoreMessageType) {
        this.messenger.unsetHandlerFor(type);
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
                    await this.ilatex.visualisationModelManager.dispatchWebviewMessage(
                        message as NotifyVisualisationModelMessage
                    );
                });
            }
        );

        this.setHandlerFor(
            WebviewToCoreMessageType.SaveAndRecompileRequest,
            async (message) => {
                await this.ilatex.sourceFileManager.saveAllSourceFiles();

                // TODO: remove this
                // If the PDF is not already being compiled, rebuild it once the files have been saved
                if (!this.ilatex.pdfManager.isBuildingPDF) {
                    await this.ilatex.pdfManager.recompilePDFAndUpdateWebview();
                }
            }
        );
    }

    private setInitialWebviewHtml(): void {
        const inlinedWebviewHtmlFile = ExtensionFileReader.readExtensionFile("./out/webview/webview.inlined.html");
        this.webview.html = inlinedWebviewHtmlFile.content;
    }

    dispose(): void {
        this.messenger.stopHandlingMessages();
        this.webviewPanelStateChangeObserverDisposable.dispose();
    }

    revealWebviewPanel(): void {
        // By default, the webview panel is displayed in the second column
        this.webviewPanel.reveal(vscode.ViewColumn.Two);
    }

    createWebviewSafeUri(uri: vscode.Uri): vscode.Uri {
        return this.webview.asWebviewUri(uri);
    }

    sendNewContentForOneVisualisation(
        visualisationModel: VisualisationModel,
        updateOpenVisualisation: boolean = true
    ): void {
        console.info("About to send new content for all visualisations to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateOneVisualisation,
            visualisationUid: visualisationModel.uid,
            visualisationContentAsHtml: visualisationModel.content,
            updateOpenVisualisation: updateOpenVisualisation
        });
    }

    sendNewContentForAllVisualisations(
        updateOpenVisualisation: boolean = false
    ): void {
        console.info("About to send new content for all visualisations to the webview...");
        const newContent = this.ilatex.visualisationModelManager.contentOfAllModels;

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateAllVisualisations,
            allVisualisationsContentAsHtml: newContent,
            updateOpenVisualisation: updateOpenVisualisation
        });
    }

    sendNewPDF(): void {
        console.info("About to send a new PDF to the webview...");
        const pdfUri = this.ilatex.pdfManager.pdfUri;

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdatePDF,
            pdfUri: this.createWebviewSafeUri(pdfUri).toString()
        });
    }

    // TODO: hook into the PDF manager for this?
    sendNewPDFCompilationStatus(pdfIsCurrentylCompiled: boolean, lastCompilationFailed: boolean = false): void {
        console.info("About to send a new PDF compilation status to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateCompilationStatus,
            pdfIsCurrentlyCompiled: pdfIsCurrentylCompiled,
            lastCompilationFailed: lastCompilationFailed
        });        
    }

    sendNewStatusForOneVisualisation(visualisationModel: VisualisationModel): void {
        console.info("About to send a new visualisation status to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateVisualisationStatusMessage,
            visualisationUid: visualisationModel.uid,
            visualisationIsAvailable: visualisationModel.status.available
        });        
    }

    sendNewStatusForAllVisualisations(enableAllVisualisations: boolean): void {
        console.info("About to send a new visualisation status to the webview...");

        this.messenger.sendMessage({
            type: CoreToWebviewMessageType.UpdateVisualisationStatusMessage,
            enableAllVisualisations: enableAllVisualisations
        });        
    }
}