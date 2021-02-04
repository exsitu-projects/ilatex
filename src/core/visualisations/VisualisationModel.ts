import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";

/** Type of a unique visualisation model identifier. */
export type VisualisationModelUID = number;

/** Type of the content produced by visualisation models and expected by visualisation views (currently a HTML string). */
export type VisualisationContent = string;

/** Type of the status of a visualisation, i.e. general information about its current state. */
export interface VisualisationStatus {
    /** A flag indicating whether the visualisation can be used by the user or not. */
    available: boolean;
};


export interface VisualisationModel {
    readonly name: string;
    readonly uid: VisualisationModelUID;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly statusChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;

    readonly sourceFile: SourceFile;
    readonly codeMapping: CodeMapping;
    readonly astNode: ASTNode;

    readonly status: VisualisationStatus;
    readonly content: VisualisationContent;

    processViewMessage(message: NotifyVisualisationModelMessage): Promise<void>;
}