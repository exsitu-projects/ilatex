import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";

/** Type of a unique visualisation model identifier. */
export type VisualisationModelUID = number;

/** Type of the content produced by visualisation models and expected by visualisation views (currently a HTML string). */
export type VisualisationContent = string;


export interface VisualisationModel {
    readonly name: string;
    readonly uid: VisualisationModelUID;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly availabilityChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;

    readonly sourceFile: SourceFile;
    readonly codeMapping: CodeMapping;
    readonly astNode: ASTNode;

    readonly content: VisualisationContent;
    readonly isAvailable: boolean;

    processViewMessage(message: NotifyVisualisationModelMessage): Promise<void>;
}