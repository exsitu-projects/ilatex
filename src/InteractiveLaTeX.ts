import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/visitors/LatexASTFormatter';
import { VisualisationManager } from './visualisations/VisualisationManager';

export class InteractiveLaTeX {
    // The path must be relative to the root directory of the extension
    private static readonly WEBVIEW_TEMPLATE_PATH = "./templates/webview.html";
    // private static readonly WEBVIEW_TEMPLATE_PATH = "./templates/frame.html";

    private document: vscode.TextDocument;
    private webviewPanel: vscode.WebviewPanel;
    private webviewTemplate: string;
    private visualisationManager: VisualisationManager;
    
    constructor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        this.document = document;
        this.webviewPanel = webviewPanel;
        this.webviewTemplate = "";
        this.visualisationManager = new VisualisationManager(document, webviewPanel);
        
        this.loadWebviewTemplate();

        this.parseActiveDocument();
        this.startObservingDocumentChanges();
    }

    private loadWebviewTemplate(): void {
        const thisExtension = vscode.extensions.getExtension("exsitu.interactive-latex");
        if (thisExtension !== undefined) {
            const extensionDirectoryPath = thisExtension.extensionPath;
            const templatePath = path.resolve(
                extensionDirectoryPath,
                InteractiveLaTeX.WEBVIEW_TEMPLATE_PATH
            );

            const templateFileBuffer = fs.readFileSync(templatePath);
            this.webviewTemplate = templateFileBuffer.toString();
        }
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
                this.updateWebview();
            }
            catch (error) {
                console.error(error);
            }
        });
    }

    private renderWebviewContentAsHTML(): string {
        // return this.webviewTemplate;

        return this.webviewTemplate.replace(
            "<!--VISUALISATIONS-->",
            this.visualisationManager.renderAllVisualisationsAsHTML()
        );
    }

    private updateWebview(): void {
        this.webviewPanel.webview.html = this.renderWebviewContentAsHTML();
    }
}