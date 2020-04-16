import * as vscode from 'vscode';
import { LatexAST } from "../ast/LatexAST";
import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { Visualisation, VisualisationID } from './Visualisation';
import { IncludeGraphicsVisualisation } from './IncludeGraphicsVisualisation';
import { TabularVisualisation } from './TabularVisualisation';
import { WebviewManager } from '../webview/WebviewManager';

export class VisualisationManager {
    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;
    private visualisations: Visualisation[];
    private patternDetector: CodePatternDetector;

    constructor(document: vscode.TextDocument, webviewManager: WebviewManager) {
        this.document = document;
        this.webviewManager = webviewManager;
        this.visualisations = [];
        this.patternDetector = new CodePatternDetector();

        this.initPatternDetector();
    }

    private initPatternDetector(): void {
        // Commands to detect
        this.patternDetector.commandPatterns.push(
            {
                match: node => node.name === "includegraphics",
                onMatch: node => {
                    this.visualisations.push(
                        new IncludeGraphicsVisualisation(node, this.document, this.webviewManager)
                    );
                }
            }
        );

        // Environements to detect
        this.patternDetector.environementsPatterns.push(
            {
                match: node => node.name === "tabular",
                onMatch: node => {
                    this.visualisations.push(new TabularVisualisation(node, this.document));
                }
            }
        );
    }

    getVisualisation(id: VisualisationID): Visualisation | null {
        const result = this.visualisations
            .find(visualisation => visualisation.id === id);

        return result ?? null;
    }

    getVisualisationAtIndex(sourceIndex: number): Visualisation | null {
        const result = this.visualisations
            .find(visualisation => visualisation.sourceIndex === sourceIndex);

        return result ?? null;
    }

    getVisualisationAtPosition(position: vscode.Position): Visualisation | null {
        const result = this.visualisations.find(visualisation => {
            const start = visualisation.node.start;
            const end = visualisation.node.end;
            
            const startPos = new vscode.Position(start.line - 1, start.column - 1);
            const endPos = new vscode.Position(end.line - 1, end.column - 1);

            return position.isAfterOrEqual(startPos)
                && position.isBeforeOrEqual(endPos);
        });

        return result ?? null;
    }

    private createVisualisationsFromPatterns(ast: LatexAST): void {
        ast.visitWith(this.patternDetector);
    }

    renderAllVisualisationsAsHTML(): string {
        return this.visualisations
            .map(visualisation => visualisation.renderAsHTML())
            .join("\n");
    }

    updateVisualisations(ast: LatexAST): void {
        // Reset the source index counter of the visualisations
        // to assign a fresh order to the new visualisations
        Visualisation.resetSourceIndex();

        // Re-create the visualisations from the (new) AST
        this.visualisations = [];
        this.createVisualisationsFromPatterns(ast);
    }
}