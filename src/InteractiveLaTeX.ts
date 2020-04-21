import * as vscode from 'vscode';
import * as fs from 'fs';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/visitors/LatexASTFormatter';
import { VisualisationManager } from './visualisations/VisualisationManager';
import { WebviewManager } from './webview/WebviewManager';
import { WebviewMessageType, SelectTextMessage, FocusVisualisationMessage, ReplaceTextMessage } from './webview/WebviewMessage';

export class InteractiveLaTeX {
    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;
    private visualisationManager: VisualisationManager;

    private documentChangeWatcher: fs.FSWatcher | null;
    private documentPDFChangeWatcher: fs.FSWatcher | null;
    
    constructor(editor: vscode.TextEditor, panel: vscode.WebviewPanel) {
        this.editor = editor;
        this.document = editor.document;
        this.webviewManager = new WebviewManager(panel);
        this.visualisationManager = new VisualisationManager(this.document, this.webviewManager);
        
        this.documentChangeWatcher = null;
        this.documentPDFChangeWatcher = null;

        this.initWebviewMessageHandlers();
        this.startObservingDocumentChanges();
        this.startObservingDocumentPDFChanges();
        this.startObservingSelectionChanges();

        this.parseActiveDocument();
        this.updateWebviewVisualisations();
        this.updateWebviewPDF();
    }

    initWebviewMessageHandlers(): void {
        // Text must be selected
        this.webviewManager.setHandlerFor(WebviewMessageType.SelectText, (message) => {
            const selectTextMessage = message as SelectTextMessage;
            const startPosition = new vscode.Position(selectTextMessage.from.lineIndex, selectTextMessage.from.columnIndex)
            const endPosition = new vscode.Position(selectTextMessage.to.lineIndex, selectTextMessage.to.columnIndex);

            this.editor.selections = [new vscode.Selection(startPosition, endPosition)];

            if (selectTextMessage.scroll) {
                this.editor.revealRange(
                    new vscode.Range(startPosition, endPosition),
                    vscode.TextEditorRevealType.InCenterIfOutsideViewport
                );
            }
        });

        // Text must be replaced
        this.webviewManager.setHandlerFor(WebviewMessageType.ReplaceText, async (message) => {
            const replaceTextMessage = message as ReplaceTextMessage;
            const rangeToEdit = new vscode.Range(
                new vscode.Position(replaceTextMessage.from.lineIndex, replaceTextMessage.from.columnIndex),
                new vscode.Position(replaceTextMessage.to.lineIndex, replaceTextMessage.to.columnIndex)
            );

            await this.editor.edit((editBuilder) => {
                editBuilder.replace(rangeToEdit, replaceTextMessage.with);
            });

            if (replaceTextMessage.saveDocument) {
                this.document.save();
            }
        });

        // The document must be saved
        this.webviewManager.setHandlerFor(WebviewMessageType.SaveDocument, (message) => {
            this.document.save();
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

    private onDocumentChange(): void {
        const date = new Date();
        console.log(`(${date.getMinutes()}:${date.getSeconds()}) The LaTeX document has changed`);

        // Re-build and re-parse the document
        vscode.commands.executeCommand("latex.build");
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

    private startObservingSelectionChanges(): void {
        vscode.window.onDidChangeTextEditorSelection((event) => {
            // If the user moves the cursor WITHOUT selecting text,
            // check if it is inside the code associated to a visualisation.
            const selectionStartPos = event.selections[0].start;
            const selectionEndPos = event.selections[0].end;

            if (selectionStartPos.isEqual(selectionEndPos)) {
                // If it is, tell the webview to highlight the related visualisation.
                const visualisation = this.visualisationManager.getVisualisationAtPosition(selectionStartPos);
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

            // Update the visualisations
            this.visualisationManager.updateVisualisations(ast);
        }
        catch (error) {
            console.error(error);
        }
    }

    updateWebviewVisualisations() {
        const visualisationsHtml = this.visualisationManager.renderAllVisualisationsAsHTML();
        this.webviewManager.updateWebviewVisualisations(visualisationsHtml);
    }

    updateWebviewPDF() {
        const pdfUri = this.getDocumentPDFUri();
        this.webviewManager.updateWebviewPDF(pdfUri);
    }
}