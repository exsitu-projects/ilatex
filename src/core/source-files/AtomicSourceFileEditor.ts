import * as vscode from "vscode";
import { SourceFile } from "./SourceFile";
import { SourceFilePosition } from "./SourceFilePosition";
import { SourceFileRange } from "./SourceFileRange";

export type SourceFileEdit = (editBuilder: vscode.TextEditorEdit) => void;
export type SourceFileEditProvider = (editor: AtomicSourceFileEditor) => Promise<void>;

export class AtomicSourceFileEditor {
    protected sourceFile: SourceFile;
    protected editProviders: SourceFileEditProvider[];
    private edits: ((editBuilder: vscode.TextEditorEdit) => void)[];

    constructor(sourceFile: SourceFile, editProviders: SourceFileEditProvider[] = []) {
        this.sourceFile = sourceFile;
        this.editProviders = [...editProviders];
        this.edits = [];
    }

    addEditProviders(...editProviders: SourceFileEditProvider[]): void {
        this.editProviders.push(...editProviders);
    }

    addEdits(...edits: SourceFileEdit[]): void {
        this.edits.push(...edits);
    }

    insert(position: SourceFilePosition, text: string): void {
        this.edits.push(editBuilder => editBuilder.insert(position.asVscodePosition, text));
    }

    replace(range: SourceFileRange, text: string): void {
        this.edits.push(editBuilder => editBuilder.replace(range.asVscodeRange, text));
    }

    delete(range: SourceFileRange): void {
        this.edits.push(editBuilder => editBuilder.delete(range.asVscodeRange));
    }

    async apply(): Promise<void> {
        const editor = await this.sourceFile.getOrOpenInEditor();
        for (let editProvider of this.editProviders) {
            await editProvider(this);
        }

        // Do not log changes that originate from the iLaTeX extension
        this.sourceFile.skipChangeLogging = true;

        const success = await editor.edit(editBuilder => {
            for (let edit of this.edits) {
                edit(editBuilder);
            }
        });

        if (!success) {
            console.warn("One of the following edits could not be performed (the whole batch failed):", this.edits);
        }

        this.sourceFile.skipChangeLogging = false;
    }
}