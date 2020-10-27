import * as vscode from 'vscode';
import * as fs from 'fs';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/visitors/LatexASTFormatter';
import { WebviewManager } from './webview/WebviewManager';
import { VisualisationModelManager } from './visualisations/VisualisationModelManager';
import { NotifyVisualisationModelMessage, WebviewToCoreMessageType } from '../shared/messenger/messages';
import { TaskQueuer } from '../shared/tasks/TaskQueuer';
import { TaskDebouncer } from '../shared/tasks/TaskDebouncer';

export class InteractiveLaTeX {
    private static readonly DELAY_BETWEEN_DOCUMENT_CHANGE_POLLING = 500; // ms

    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;
    private webviewPanel: vscode.WebviewPanel;
    private webviewManager: WebviewManager;
    private visualisationModelManager: VisualisationModelManager;

    private documentChangeWatcher: fs.FSWatcher | null;
    private pdfChangeWatcher: fs.FSWatcher | null;
    
    constructor(editor: vscode.TextEditor, webviewPanel: vscode.WebviewPanel) {
        this.editor = editor;
        this.document = editor.document;
        this.webviewPanel = webviewPanel;
        this.webviewManager = new WebviewManager(webviewPanel.webview);
        this.visualisationModelManager = new VisualisationModelManager(this, this.editor, this.webviewManager);
        
        this.documentChangeWatcher = null;
        this.pdfChangeWatcher = null;

        this.initWebviewMessageHandlers();
        this.startObservingWebviewPanelStateChanges();
        this.startObservingDocumentChanges();

        this.extractNewVisualisationModels();
        this.updateWebviewVisualisations();
        this.updateWebviewPDF();
    }

    private get pdfPath(): string {
        // This assumes that the PDF of the document has the same path
        // than the LaTeX document but with a .pdf extension instead

        // TODO: use a more robust technique,
        // e.g. by allowing the user to specify this value

        return this.document.uri.path.replace(".tex", ".pdf");
    }

    private get pdfUri(): vscode.Uri {
        return vscode.Uri.file(this.pdfPath);
    }

    private get pdfExists(): boolean {
        return fs.existsSync(this.pdfPath);
    }

    initWebviewMessageHandlers(): void {
        // Save the document
        this.webviewManager.setHandlerFor(WebviewToCoreMessageType.SaveDocument, async (message) => {
            await this.document.save();
        });

        // Dispatch a webview notification to the right visualisation.
        // Since notification handlers can perform asynchronous operations,
        // notification message are queued and dispatched one after the other.
        const notificationDispatchQueuer = new TaskQueuer();

        this.webviewManager.setHandlerFor(
            WebviewToCoreMessageType.NotifyVisualisationModel,
            async (message) => {
                notificationDispatchQueuer.add(async () => {
                    this.visualisationModelManager.dispatchNotification(
                        message as NotifyVisualisationModelMessage
                    );
                });
            }
        );
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
            // If the webview panel is visible (possibly having been hidden by the user),
            // force the webview to reload the PDF with the last visualisations
            if (event.webviewPanel.visible) {
                this.updateWebviewVisualisations();
                this.updateWebviewPDF();
            }
        });
    }

    private startObservingDocumentChanges(): void {
        const documentPath = this.document.uri.fsPath;
        const documentChangeDebouncer = new TaskDebouncer(
            InteractiveLaTeX.DELAY_BETWEEN_DOCUMENT_CHANGE_POLLING
        );

        this.documentChangeWatcher = fs.watch(documentPath, (event, filename) => {
            documentChangeDebouncer.add(async () => {
                this.handleDocumentChange();
            });
        });
    }

    private buildPDFAndUpdateWebview(): void {
        // TODO: start latexmk in watch mode once?

        // Create a new terminal and use it to run latexmk to build a PDF from the sources
        const terminal = vscode.window.createTerminal("iLaTeX");

        const terminalSafeFilename = this.document.fileName.replace(/ /g, "\\ ");
        terminal.sendText(`cd ${terminalSafeFilename.substr(0, terminalSafeFilename.lastIndexOf("/"))}`);
        terminal.sendText(`latexmk -interaction=nonstopmode ${terminalSafeFilename}`);
        // terminal.sendText(`latexmk -c`);

        // Close the terminal right after running latexmk
        // Note: if no exit code is specified, the exit command
        // reuses the same exit code than the last command
        terminal.sendText(`exit`);

        // Use the terminal closing as a signal to trigger an update of the webview PDF
        // This is a workaround to the fact that there is no built-in way
        // to wait for the end of a running process in a VSCode terminal
        vscode.window.onDidCloseTerminal(terminal => {
            if (terminal.exitStatus && terminal.exitStatus.code !== 0) {
                vscode.window.showErrorMessage("An error occured during the compilation of the document.");
                return;
            }

            this.updateWebviewPDF();
        });
    }

    private extractVisualisationsAndUpdateWebview(requestedByVisualisation: boolean = false): void {
        this.extractNewVisualisationModels();
        this.updateWebviewVisualisations(requestedByVisualisation);
    }

    private handleDocumentChange(): void {
        this.buildPDFAndUpdateWebview();
        this.extractVisualisationsAndUpdateWebview();
    }

    handleVisualisationParsingRequest() {
        this.extractVisualisationsAndUpdateWebview(true);
    }

    private async extractNewVisualisationModels() {
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
        console.info("About to update the webview visualisations...");

        const visualisationViewsContent = this.visualisationModelManager.createAllViewContent();
        this.webviewManager.updateVisualisationViewContent(visualisationViewsContent, requestedByVisualisation);
    }

    updateWebviewPDF() {
        console.info("About to update the webview PDF...");
        
        this.webviewManager.updatePDF(this.pdfUri);
    }
}