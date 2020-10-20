import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTNode } from "../ast/LatexASTNode";
import { InteractiveLaTeX } from "../InteractiveLaTeX";
import { WebviewManager } from "../webview/WebviewManager";

// Type and generator for model identifiers
// Each model instance must have a *unique* identifier,
// which uniquely identifies this very version of the model
export type ModelID = number;
export abstract class ModelIDGenerator {
    private static maxUsedValue: number = 0;
    
    static getUniqueId(): ModelID {
        ModelIDGenerator.maxUsedValue += 1;
        return this.maxUsedValue;
    }
}

// Type and counter for source indices
// Each model instance must have a source index,
// which identifies the relative position of the piece of code
// attached to the visualisation
export type SourceIndex = number;
export abstract class SourceIndexCounter {
    private static currentSourceIndex: number = 0;
    
    static getNextSourceIndex(): SourceIndex {
        SourceIndexCounter.currentSourceIndex += 1;
        return this.currentSourceIndex;
    }

    static reset(): void {
        this.currentSourceIndex = 0;
    }
}

export interface VisualisationModel {
    readonly visualisationName: string;
    readonly id: ModelID
    readonly sourceIndex: SourceIndex;

    handleViewNotification(message: NotifyVisualisationModelMessage): Promise<void>;
    createViewContent(): string;
}

export interface VisualisationModelFactory {
    readonly visualisationName: string;
    readonly codePatternMatcher: (node: ASTNode) => boolean;

    createModel(
        node: ASTNode,
        ilatex: InteractiveLaTeX,
        editor: vscode.TextEditor,
        webviewManager: WebviewManager
    ): VisualisationModel;
}