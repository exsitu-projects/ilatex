import * as vscode from 'vscode';
import { LatexAST } from "../ast/LatexAST";
import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { Visualisation } from './Visualisation';
import { IncludeGraphicsVisualisation } from './IncludeGraphicsVisualisation';
import { TabularVisualisation } from './TabularVisualisation';

export class VisualisationManager {
    private document: vscode.TextDocument;
    private webviewPanel: vscode.WebviewPanel;
    private visualisations: Visualisation[];
    private patternDetector: CodePatternDetector;

    constructor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel) {
        this.document = document;
        this.webviewPanel = webviewPanel;
        this.visualisations = [];

        this.patternDetector = new CodePatternDetector();
        this.initPatternDetector();
    }

    private initPatternDetector() {
        // Commands to detect
        this.patternDetector.commandPatterns.push(
            {
                match: node => node.name === "includegraphics",
                onMatch: node => {
                    this.visualisations.push(new IncludeGraphicsVisualisation(node));
                }
            }
        );

        // Environements to detect
        this.patternDetector.environementsPatterns.push(
            {
                match: node => node.name === "tabular",
                onMatch: node => {
                    this.visualisations.push(new TabularVisualisation(node));
                }
            }
        );
    }

    private createVisualisationsFromPatterns(ast: LatexAST): void {
        ast.visit(this.patternDetector);
    }

    private renderAllVisualisationsAsHTML(): string {
        const contentHTML = this.visualisations
            .map(visualisation => visualisation.renderAsHTML())
            .join("\n");

        return `
            <!DOCTYPE>
            <html>
                <body>
                    ${contentHTML}
                </body>
            </html>
        `;
    }

    updateVisualisations(ast: LatexAST): void {
        // Re-create the visualisations from the (new) AST
        this.visualisations = [];
        this.createVisualisationsFromPatterns(ast);

        // Update the view
        console.log("The view will be updated with the following visualisations:");
        console.log(this.visualisations);

        console.log(this.renderAllVisualisationsAsHTML())
        this.webviewPanel.webview.html = this.renderAllVisualisationsAsHTML(); 
    }
}