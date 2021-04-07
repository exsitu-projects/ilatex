import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { VisualisationModelUID, VisualisationMetadata, VisualisationContent } from "../../shared/visualisations/types";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { SourceFileRange } from "../source-files/SourceFileRange";

export interface VisualisationModel {
    readonly name: string;
    readonly uid: VisualisationModelUID;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly metadataChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;

    readonly sourceFile: SourceFile;
    readonly codeMapping: CodeMapping;
    readonly astNode: ASTNode;
    readonly codeRange: SourceFileRange;

    readonly metadata: VisualisationMetadata;
    readonly content: VisualisationContent;

    init(): Promise<void>;

    processViewMessage(message: NotifyVisualisationModelMessage): Promise<void>;
    dispose(): void;
}