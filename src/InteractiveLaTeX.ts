import * as vscode from 'vscode';
import * as fs from 'fs';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/visitors/LatexASTFormatter';
import { VisualisationManager } from './visualisations/VisualisationManager';
import { WebviewManager } from './webview/WebviewManager';
import { WebviewMessageType, SelectTextMessage, FocusVisualisationMessage } from './webview/WebviewMessage';

export class InteractiveLaTeX {
    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;
    private visualisationManager: VisualisationManager;
    
    constructor(editor: vscode.TextEditor, panel: vscode.WebviewPanel) {
        this.editor = editor;
        this.document = editor.document;
        this.webviewManager = new WebviewManager(panel);
        this.visualisationManager = new VisualisationManager(this.document, this.webviewManager);
        
        this.initWebviewMessageHandlers();
        this.startObservingDocumentChanges();
        this.startObservingSelectionChanges();
        this.parseActiveDocument();
    }

    initWebviewMessageHandlers(): void {
        // Text must be selected
        this.webviewManager.setHandlerFor(WebviewMessageType.SelectText, (message) => {
            const selectTextMessage = message as SelectTextMessage;
            this.editor.selections = [new vscode.Selection(
                new vscode.Position(selectTextMessage.from.lineIndex, selectTextMessage.from.columnIndex),
                new vscode.Position(selectTextMessage.to.lineIndex, selectTextMessage.to.columnIndex)
            )];
        });
    }

    private startObservingDocumentChanges(): void {
        const documentPath = this.document.uri.fsPath;

        let waitBeforeNextObservation = false;
        fs.watch(documentPath, (event, filename) => {
            if (filename) {
                if (waitBeforeNextObservation) {
                    return;
                }

                waitBeforeNextObservation = true;
                setTimeout(() => {
                    waitBeforeNextObservation = false;
                }, 100);

                this.onDocumentChange();
            }
        });
    }

    private onDocumentChange(): void {
        this.parseActiveDocument();
    }

    private startObservingSelectionChanges(): void {
        vscode.window.onDidChangeTextEditorSelection((event) => {
            // If the user moves the cursor WITHOUT selecting text,
            // check if it is inside the code associated to a visualisation.
            const selectionStartPos = event.selections[0].start;
            const selectionEndPos = event.selections[0].end;

            if (selectionStartPos.isEqual(selectionEndPos)) {
                // If it is, tell the webview to highlight the related visualisation.
                const visualisation = this.visualisationManager.getVisualisationAtPosition(selectionStartPos);
                console.log("Cursor is inside visualisation:", visualisation);
                
                if (visualisation) {
                    this.webviewManager.sendMessage({
                        type: WebviewMessageType.FocusVisualisation,
                        id: visualisation.id
                    } as FocusVisualisationMessage);
                }
            }
        });
    }

    private async parseActiveDocument() {
        const documentPath = this.document.uri.fsPath;

        fs.readFile(documentPath, (error, data) => {
            const fileContent = data.toString();

            try {
                const ast = new LatexAST(fileContent);

                // Pretty-print the AST for debugging purposes
                const formatter = new LatexASTFormatter();
                ast.visitWith(formatter);
                console.log(formatter.formattedAST);

                // Update the visualisations
                this.visualisationManager.updateVisualisations(ast);

                // Update the webview
                const content = this.visualisationManager.renderAllVisualisationsAsHTML();
                this.webviewManager.updateWebviewWith(content);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
}