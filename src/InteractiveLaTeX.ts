import * as vscode from 'vscode';
import * as fs from 'fs';
import { LatexAST } from './ast/LatexAST';
import { LatexASTFormatter } from './ast/LatexASTFormatter';
import { VisualisationManager } from './visualisations/VisualisationManager';

export class InteractiveLaTeX {
    private document: vscode.TextDocument;
    private visualisationManager: VisualisationManager;
    
    constructor(document: vscode.TextDocument) {
        this.document = document;
        this.visualisationManager = new VisualisationManager(document);
        
        this.parseActiveDocument();
        this.startObservingDocumentChanges();
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
        // console.log(`${filename} changed.`);
        this.parseActiveDocument();
    }

    private async parseActiveDocument() {
        const documentPath = this.document.uri.fsPath;

        fs.readFile(documentPath, (error, data) =>  {
            const fileContent = data.toString();

            try {
                const ast = new LatexAST(fileContent);

                // Update the visualisations
                this.visualisationManager.updateVisualisations(ast);

                // Pretty-print the AST for debugging purposes
                const formatter = new LatexASTFormatter();
                ast.visit(formatter);
                console.log(formatter.formattedAST);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
}