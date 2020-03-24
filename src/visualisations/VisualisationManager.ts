import * as vscode from 'vscode';
import { LatexAST } from "../ast/LatexAST";
import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { Visualisation } from './Visualisation';
import { IncludeGraphicsVisualisation } from './IncludeGraphicsVisualisation';
import { TabularVisualisation } from './TabularVisualisation';

export class VisualisationManager {
    private document: vscode.TextDocument;
    private visualisations: Visualisation[];
    private patternDetector: CodePatternDetector;

    constructor(document: vscode.TextDocument) {
        this.document = document;
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

    updateVisualisations(ast: LatexAST): void {
        this.visualisations = [];
        this.createVisualisationsFromPatterns(ast);

        // TODO: update the view at this point
        
        console.log("The view should be updated with the following visualisations:");
        console.log(this.visualisations);
    }
}