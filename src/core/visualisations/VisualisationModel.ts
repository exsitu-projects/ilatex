import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTNode } from "../ast/LatexASTNode";
import { CodeMapping, CodeMappingID } from "../mappings/CodeMapping";
import { SourceFile } from "../mappings/SourceFile";

// Type and generator of unique model identifiers
// Each model instance must have a *unique* identifier,
// which uniquely identifies this very version of the model
export type ModelUID = number;
export abstract class ModelIDGenerator {
    private static maxUsedValue: number = 0;
    
    static getUniqueId(): ModelUID {
        ModelIDGenerator.maxUsedValue += 1;
        return this.maxUsedValue;
    }
}

export interface VisualisationModel {
    readonly visualisationName: string;
    readonly codeMappingId: CodeMappingID;
    readonly uid: ModelUID;

    readonly sourceFile: SourceFile;
    readonly codeRange: vscode.Range;

    readonly hasBeenManuallyEdited: boolean;
    readonly onModelChangeEventEmitter: vscode.EventEmitter<this>;

    isAbleToHandleChangeIn(filePath: string, range: vscode.Range): boolean;
    handleViewNotification(message: NotifyVisualisationModelMessage): Promise<void>;
    createViewContent(): string;
}

export interface VisualisationModelUtilities {
    readonly mainSourceFileUri: vscode.Uri;
    createWebviewSafeUri(uri: vscode.Uri): vscode.Uri;
    requestNewParsingOf(sourceFile: SourceFile): Promise<void>;
}

export interface VisualisationModelFactory {
    readonly visualisationName: string;
    readonly astMatchingRule: (node: ASTNode) => boolean;

    createModel(
        node: ASTNode,
        mapping: CodeMapping,
        utilities: VisualisationModelUtilities
    ): VisualisationModel;
}