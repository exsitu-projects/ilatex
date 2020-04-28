import * as vscode from 'vscode';
import { LatexAST } from "../ast/LatexAST";
import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { Visualisation, VisualisationID } from './Visualisation';
import { IncludeGraphicsVisualisation } from './IncludeGraphicsVisualisation';
import { TabularVisualisation } from './TabularVisualisation';
import { WebviewManager } from '../webview/WebviewManager';
import { NotifyVisualisationMessage } from '../webview/WebviewMessage';

export class VisualisationManager {
    private editor: vscode.TextEditor;
    private webviewManager: WebviewManager;
    private visualisations: Visualisation[];
    private patternDetector: CodePatternDetector;

    constructor(editor: vscode.TextEditor, webviewManager: WebviewManager) {
        this.editor = editor;
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
                        new IncludeGraphicsVisualisation(node, this.editor, this.webviewManager)
                    );
                }
            }
        );

        // Environements to detect
        this.patternDetector.environementsPatterns.push(
            {
                match: node => node.name === "tabular",
                onMatch: node => {
                    this.visualisations.push(new TabularVisualisation(node, this.editor, this.webviewManager));
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

    async dispatchWebviewNotification(message: NotifyVisualisationMessage) {
        const visualisation = this.getVisualisationAtIndex(message.sourceIndex);
        if (visualisation === null) {
            console.error(`iLatex cannot dispatch the notification: there is no visualisation at source index ${message.sourceIndex}.`);
            return;
        }

        return visualisation.handleWebviewNotification(message);
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