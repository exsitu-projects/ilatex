import * as vscode from "vscode";
import { MessageHandler } from "../../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessage, CoreToWebviewMessageType, NotifyVisualisationModelMessage, WebviewToCoreMessage, WebviewToCoreMessageType } from "../../shared/messenger/messages";
import { SILENT_TASK_ERROR_HANDLER } from "../../shared/tasks/Task";
import { TaskQueuer } from "../../shared/tasks/TaskQueuer";
import { InteractiveLatex } from "../InteractiveLatex";
import { ExtensionFileReader } from "../utils/ExtensionFileReader";
import { VisualisationModel } from "../visualisations/VisualisationModel";
import { Messenger } from "./Messenger";


export class WebviewManager {
    private ilatex: InteractiveLatex;

    private webviewPanel: vscode.WebviewPanel;
    private webview: vscode.Webview;
    private messenger: Messenger;

    // Asycnhronous queues to manage async message dispatch/sending more easily
    private incomingMessageDispatchQueuer: TaskQueuer;
    private outgoingMessageQueuer: TaskQueuer;

    private webviewPanelHasBeenDisposed: boolean;

    private webviewPanelDidDisposeObserverDisposable: vscode.Disposable;
    private webviewPanelStateChangeObserverDisposable: vscode.Disposable;

    constructor(ilatex: InteractiveLatex, webviewPanel: vscode.WebviewPanel) {
        this.ilatex = ilatex;
        this.webviewPanel = webviewPanel;
        this.webview = webviewPanel.webview;

        this.messenger = new Messenger(this.webview);
        this.messenger.startHandlingMessages();

        this.incomingMessageDispatchQueuer = new TaskQueuer(SILENT_TASK_ERROR_HANDLER);
        this.outgoingMessageQueuer = new TaskQueuer(SILENT_TASK_ERROR_HANDLER);

        this.webviewPanelHasBeenDisposed = false;
        this.webviewPanelDidDisposeObserverDisposable = webviewPanel.onDidDispose(() => {
            this.webviewPanelHasBeenDisposed = true;
            this.messenger.stopHandlingMessages();
        });

        this.webviewPanelStateChangeObserverDisposable = this.webviewPanel.onDidChangeViewState(event => {
            // If the webview panel becomes visible again, force update the PDF and the visualisations.
            // This is required to ensure the webview content is up-to-date
            // because VSCode does not enable hidden webviews to handle messages
            // (see retainContextWhenHidden in https://code.visualstudio.com/api/references/vscode-api#WebviewPanelOptions).
            if (event.webviewPanel.visible) {
                this.sendNewPDF(); // TODO: not if the last compilation failed
                this.sendNewVisualisationContentAndMetadataForAllModels();
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
        this.setHandlerFor(
            WebviewToCoreMessageType.NotifyVisualisationModel,
            async (message) => {
                this.incomingMessageDispatchQueuer.add(async () => {
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
                this.ilatex.recompileAndUpdate();
            }
        );
    }

    private setInitialWebviewHtml(): void {
        const inlinedWebviewHtmlFile = ExtensionFileReader.readExtensionFile("./out/webview/webview.inlined.html");
        this.webview.html = inlinedWebviewHtmlFile.content;
    }

    dispose(): void {
        this.messenger.stopHandlingMessages();
            
        this.incomingMessageDispatchQueuer.clearNextTasks();
        this.outgoingMessageQueuer.clearNextTasks();

        this.webviewPanelDidDisposeObserverDisposable.dispose();
        this.webviewPanelStateChangeObserverDisposable.dispose();
        
        if (!this.webviewPanelHasBeenDisposed) {
            this.webviewPanel.dispose();
        }
    }

    revealWebviewPanel(): void {
        // By default, the webview panel is displayed in the second column
        this.webviewPanel.reveal(vscode.ViewColumn.Two);
    }

    createWebviewSafeUri(uri: vscode.Uri): vscode.Uri {
        if (this.webviewPanelHasBeenDisposed) {
            console.warn(`The webview safe URI cannot be created: the panel of the messenger's webview has been disposed.`);
            return uri;
        }

        return this.webview.asWebviewUri(uri);
    }

    private sendMessageIfWebviewIsAvailable(message: CoreToWebviewMessage): void {
        if (this.webviewPanelHasBeenDisposed) {
            console.warn(`The message ("${message.type}") cannot be sent: the panel of the messenger's webview has been disposed.`);
            return;
        }

        this.outgoingMessageQueuer.add(async () => {
            await this.messenger.sendMessage(message);
        });
    }

    sendNewPDF(): void {
        console.info("📦 Sending a new PDF to the webview.");
        const pdfUri = this.ilatex.pdfManager.pdfUri;

        this.sendMessageIfWebviewIsAvailable({
            type: CoreToWebviewMessageType.UpdatePDF,
            pdfUri: this.createWebviewSafeUri(pdfUri).toString()
        });
    }

    sendNewPDFCompilationStatus(pdfIsCurrentylCompiled: boolean, lastCompilationFailed: boolean = false): void {
        console.info("📦 Sending a new PDF compilation status to the webview.");

        this.sendMessageIfWebviewIsAvailable({
            type: CoreToWebviewMessageType.UpdateCompilationStatus,
            pdfIsCurrentlyCompiled: pdfIsCurrentylCompiled,
            lastCompilationFailed: lastCompilationFailed
        });        
    }

    sendNewVisualisationMetadataFor(model: VisualisationModel): void {
        console.info("📦 Sending new metadata for one visualisation to the webview.");

        this.sendMessageIfWebviewIsAvailable({
            type: CoreToWebviewMessageType.UpdateVisualisationMetadata,
            codeMappingId: model.codeMapping.id,
            metadata: model.metadata
        });
    }

    sendNewVisualisationMetadataForAllModels(): void {
        for (let model of this.ilatex.visualisationModelManager.models) {
            this.sendNewVisualisationMetadataFor(model);
        }
    }

    sendNewVisualisationContentFor(model: VisualisationModel): void {
        console.info("📦 Sending new content for one visualisation to the webview.");

        this.sendMessageIfWebviewIsAvailable({
            type: CoreToWebviewMessageType.UpdateVisualisationContent,
            codeMappingId: model.codeMapping.id,
            contentAsHtml: model.content
        });
    }

    sendNewVisualisationContentForAllModels(): void {
        for (let model of this.ilatex.visualisationModelManager.models) {
            this.sendNewVisualisationContentFor(model);
        }
    }

    sendNewVisualisationContentAndMetadataForAllModels(): void {
        for (let model of this.ilatex.visualisationModelManager.models) {
            this.sendNewVisualisationContentFor(model);
            this.sendNewVisualisationMetadataFor(model);
        }        
    }

    sendNewGlobalOptions(): void {
        console.info("📦 Sending new global options to the webview.");

        this.sendMessageIfWebviewIsAvailable({
            type: CoreToWebviewMessageType.UpdateGlobalOptions,
            options: {
                enableVisualisations: this.ilatex.options.enableVisualisations
            }
        });
    }
}