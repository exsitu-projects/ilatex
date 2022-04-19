import * as vscode from "vscode";
import { SourceFile } from "./SourceFile";
import { SourceFilePosition } from "./SourceFilePosition";
import { SourceFileRange } from "./SourceFileRange";

export type SourceFileEdit = vscode.TextEdit;
export type SourceFileEditProvider = (editor: SourceFileEditor) => Promise<void>;

export class SourceFileEditor {
    protected sourceFile: SourceFile;
    protected editProviders: SourceFileEditProvider[];

    private wedits: vscode.WorkspaceEdit;

    constructor(sourceFile: SourceFile, editProviders: SourceFileEditProvider[] = []) {
        this.sourceFile = sourceFile;
        this.editProviders = [...editProviders];

        this.wedits = new vscode.WorkspaceEdit();
    }

    addEditProviders(...editProviders: SourceFileEditProvider[]): void {
        this.editProviders.push(...editProviders);
    }

    addEdits(...edits: SourceFileEdit[]): void {
        this.wedits.set(
            this.sourceFile.uri,
            this.wedits.get(this.sourceFile.uri).concat(...edits)
        );
    }

    insert(position: SourceFilePosition, text: string): void {
        this.wedits.insert(this.sourceFile.uri, position.asVscodePosition, text);
    }

    replace(range: SourceFileRange, text: string): void {
        this.wedits.replace(this.sourceFile.uri, range.asVscodeRange, text);
    }

    delete(range: SourceFileRange): void {
        this.wedits.delete(this.sourceFile.uri, range.asVscodeRange);
    }

    async apply(): Promise<void> {
        for (let editProvider of this.editProviders) {
            await editProvider(this);
        }

        // Do not log changes that originate from the iLaTeX extension
        this.sourceFile.skipChangeLogging = true;

        const success = await vscode.workspace.applyEdit(this.wedits);

        if (!success) {
            console.warn("One of the following edits could not be performed (the whole batch failed):", this.wedits);
        }

        this.sourceFile.skipChangeLogging = false;
    }
}