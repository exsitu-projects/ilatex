import * as vscode from 'vscode';
import * as fs from 'fs';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/visitors/LatexASTFormatter';
import { WebviewManager } from './webview/WebviewManager';
import { VisualisationModelManager } from './visualisations/VisualisationModelManager';
import { NotifyVisualisationModelMessage, WebviewToCoreMessageType } from '../shared/messenger/messages';

export class InteractiveLaTeX {
    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;
    private webviewPanel: vscode.WebviewPanel;
    private webviewManager: WebviewManager;
    private visualisationModelManager: VisualisationModelManager;

    private documentChangeWatcher: fs.FSWatcher | null;
    private documentPDFChangeWatcher: fs.FSWatcher | null;
    
    constructor(editor: vscode.TextEditor, webviewPanel: vscode.WebviewPanel) {
        this.editor = editor;
        this.document = editor.document;
        this.webviewPanel = webviewPanel;
        this.webviewManager = new WebviewManager(webviewPanel.webview);
        this.visualisationModelManager = new VisualisationModelManager(this, this.editor, this.webviewManager);
        
        this.documentChangeWatcher = null;
        this.documentPDFChangeWatcher = null;

        this.initWebviewMessageHandlers();
        this.startObservingWebviewPanelStateChanges();
        this.startObservingDocumentChanges();
        // this.startObservingDocumentPDFChanges();

        this.parseActiveDocument();
        this.updateWebviewVisualisations();
        this.updateWebviewPDF();
    }

    initWebviewMessageHandlers(): void {
        // Save the document
        this.webviewManager.setHandlerFor(WebviewToCoreMessageType.SaveDocument, async (message) => {
            await this.document.save();
        });

        // Dispatch a webview notification to the right visualisation.
        // Since notification handlers can perform asynchronous operations,
        // notification message are queued in a stack so that, as long as the queue is non-empty,
        // the last arrived message is dispatched as soon as the last called handler is done.
        let dispatchIsOngoing = false;
        let notificationQueue: NotifyVisualisationModelMessage[] = [];

        const dispatchNotification = async (message: NotifyVisualisationModelMessage) => {
            // Lock the dispatch mechanism
            dispatchIsOngoing = true;

            // Dispatch the event
            await this.visualisationModelManager.dispatchNotification(message);

            // Unlock the dispatch mechanism
            dispatchIsOngoing = false;
        
            if (notificationQueue.length > 0) {
                const message = notificationQueue.pop();
                // (if a new notif. message arrives at this exact moment it will be lost)
                notificationQueue = [];

                dispatchNotification(message as NotifyVisualisationModelMessage);
            }
        };

        this.webviewManager.setHandlerFor(WebviewToCoreMessageType.NotifyVisualisationModel, async (message) => {
            if (dispatchIsOngoing) {
                notificationQueue.push(message as NotifyVisualisationModelMessage);
                return;
            }
            
            dispatchNotification(message as NotifyVisualisationModelMessage);
        });
    }

    onWebviewPanelClosed(): void {
        // Anything which must be performed once the webview panel has been closed should go here
    }

    revealWebviewPanel(): void {
        // By default, the webview panel is displayed in the second column
        this.webviewPanel.reveal(vscode.ViewColumn.Two);
    }

    private startObservingWebviewPanelStateChanges(): void {
        this.webviewPanel.onDidChangeViewState(event => {
            // Update the PDF and the visualisations in the webview
            // (since the webpage may have been reloaded)
            this.updateWebviewVisualisations();
            this.updateWebviewPDF();
        });
    }

    private getDocumentPDFPath(): string {
        // TODO: use a more robust technique,
        // e.g. by allowing the user to specify this value

        // Assume that the PDF of the document has the same path
        // than the LaTeX document with a .pdf extension instead
        return this.document.uri.path.replace(".tex", ".pdf");
    }

    private getDocumentPDFUri(): vscode.Uri {
        const path = this.getDocumentPDFPath();
        return vscode.Uri.file(path);
    }

    private documentPDFExists(): boolean {
        const path = this.getDocumentPDFPath();
        return fs.existsSync(path);
    }

    private startObservingDocumentChanges(): void {
        const documentPath = this.document.uri.fsPath;
        let waitBeforeNextObservation = false;

        this.documentChangeWatcher = fs.watch(documentPath, (event, filename) => {
            if (filename) {
                if (waitBeforeNextObservation) {
                    return;
                }

                waitBeforeNextObservation = true;
                setTimeout(() => {
                    waitBeforeNextObservation = false;
                }, 500);

                this.onDocumentChange();
            }
        });
    }

    private startObservingDocumentPDFChanges(): void {
        // TODO: check if the watcher can be set up even if the PDF does not exist yet
        //if (!this.documentPDFExists()) {
        //    return;
        //}

        const pdfPath = this.getDocumentPDFPath();
        let waitBeforeNextObservation = false;

        this.documentPDFChangeWatcher = fs.watch(pdfPath, (event, filename) => {
            if (filename) {
                if (waitBeforeNextObservation) {
                    return;
                }

                waitBeforeNextObservation = true;
                setTimeout(() => {
                    waitBeforeNextObservation = false;
                }, 500);

                this.onDocumentPDFChange();
            }
        });
    }

    private buildActiveDocument(): void {
        // TODO: ensure the path/current directory are the correct ones
        // TODO: use the interactive mode once?

        // Create a new terminal and use it to run latexmk to build a PDF from the sources
        const terminal = vscode.window.createTerminal("iLaTeX");

        terminal.sendText(`cd ${this.document.fileName.substr(0, this.document.fileName.lastIndexOf("/"))}`);
        terminal.sendText(`latexmk ${this.document.fileName}`);
        terminal.sendText(`latexmk -c ${this.document.fileName}`);

        // Close the terminal right after running latexmk
        terminal.sendText(`exit`);

        // Use the terminal closing as a signal to trigger an update of the webview PDF
        // This is a workaround to the fact that there is no built-in way
        // to wait for the end of a running process in a VSCode terminal
        vscode.window.onDidCloseTerminal(terminal => {
            this.updateWebviewPDF();
        });
    }

    private onDocumentChange(): void {
        const date = new Date();
        console.log(`(${date.getMinutes()}:${date.getSeconds()}) The LaTeX document has changed`);

        // Re-build and re-parse the document
        this.buildActiveDocument();
        this.parseActiveDocument();

        // Update the visualisations in the webview
        this.updateWebviewVisualisations();
    }

    private onDocumentPDFChange(): void {
        const date = new Date();
        console.log(`(${date.getMinutes()}:${date.getSeconds()}) The PDF document has changed`);

        // Update the PDF in the webview
        this.updateWebviewPDF();
    }

    onVisualisationParsingRequest() {
        // Re-parse the document
        this.parseActiveDocument();

        // Update the visualisations in the webview
        this.updateWebviewVisualisations(true);
    }

    private async parseActiveDocument() {
        const firstLine = this.document.lineAt(0);
        const lastLine = this.document.lineAt(this.document.lineCount - 1);
        const documentContent = this.document.getText(new vscode.Range(
            firstLine.range.start,
            lastLine.range.end
        ));

        try {
            const ast = new LatexAST(documentContent);

            // Pretty-print the AST for debugging purposes
            // const formatter = new LatexASTFormatter();
            // ast.visitWith(formatter);
            // console.log(formatter.formattedAST);

            // Update the visualisation models
            this.visualisationModelManager.updateModels(ast);
        }
        catch (error) {
            console.error(error);
        }
    }

    updateWebviewVisualisations(requestedByVisualisation: boolean = false) {
        const visualisationViewsContent = this.visualisationModelManager.createAllViewContent();
        this.webviewManager.updateVisualisationViewContent(visualisationViewsContent, requestedByVisualisation);
    }

    updateWebviewPDF() {
        const pdfUri = this.getDocumentPDFUri();
        this.webviewManager.updatePDF(pdfUri);
    }
}