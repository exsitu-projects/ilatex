import * as vscode from 'vscode';
import { LatexAST } from "../ast/LatexAST";
import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { WebviewManager } from '../webview/WebviewManager';
import { InteractiveLaTeX } from '../InteractiveLaTeX';
import { VisualisationModelFactory, VisualisationModel, SourceIndex, ModelID, SourceIndexCounter } from './VisualisationModel';
import { ASTNode } from '../ast/LatexASTNode';
import { NotifyVisualisationModelMessage } from '../../shared/messenger/messages';
import { IncludegraphicsModelFactory } from '../../visualisations/includegraphics/model/model';
import { TabularModelFactory } from '../../visualisations/tabular/model/model';
import { GridLayoutModelFactory } from '../../visualisations/gridlayout/model/model';

export class VisualisationModelManager {
    private static readonly AVAILABLE_VISUALISATION_FACTORIES: VisualisationModelFactory[] = [
        new IncludegraphicsModelFactory(),
        new TabularModelFactory(),
        new GridLayoutModelFactory()
    ];

    private ilatex: InteractiveLaTeX;
    private editor: vscode.TextEditor;
    private webviewManager: WebviewManager;

    private patternDetector: CodePatternDetector;
    private visualisationModels: VisualisationModel[];
    private visualisationNamesToModelFactories: Map<string, VisualisationModelFactory>;

    constructor(ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        this.ilatex = ilatex;
        this.editor = editor;
        this.webviewManager = webviewManager;
        
        this.patternDetector = new CodePatternDetector();
        this.visualisationModels = [];
        this.visualisationNamesToModelFactories = new Map(
            VisualisationModelManager.AVAILABLE_VISUALISATION_FACTORIES
                .map(factory => [factory.visualisationName, factory])
        );

        this.initPatternDetector();
    }

    private initPatternDetector(): void {
        this.patternDetector.patterns.push(
            ...VisualisationModelManager.AVAILABLE_VISUALISATION_FACTORIES
                .map(factory => {
                    return {
                        matches: factory.codePatternMatcher,
                        onMatch: (node: ASTNode) => this.visualisationModels.push(
                            factory.createModel(node, this.ilatex, this.editor, this.webviewManager)
                        )
                    };
                })
        );
    }

    private extractNewVisualisationModelsFrom(ast: LatexAST): void {
        this.visualisationModels = [];
        ast.visitWith(this.patternDetector);
    }

    private getModelWithId(id: ModelID): VisualisationModel | null {
        const result = this.visualisationModels
            .find(model => model.id === id);

        return result ?? null;
    }

    private getModelWithSourceIndex(sourceIndex: SourceIndex): VisualisationModel | null {
        const result = this.visualisationModels
            .find(model => model.sourceIndex === sourceIndex);

        return result ?? null;
    }

    async dispatchNotification(message: NotifyVisualisationModelMessage): Promise<void> {
        const model = this.getModelWithId(message.visualisationId);
        if (!model) {
            console.error(`The notification cannot be dispatched: there is no model with ID "${message.visualisationId}".`);
            return;
        }

        return model.handleViewNotification(message);
    }

    createAllViewContent(): string {
        return this.visualisationModels
            .map(visualisation => visualisation.createViewContent())
            .join("\n");
    }

    updateModels(ast: LatexAST): void {
        // Reset the source index counter before generating new visualisations
        // to make them use fresh values for the relative order encoded by source indices
        SourceIndexCounter.reset();

        this.extractNewVisualisationModelsFrom(ast);
    }
}