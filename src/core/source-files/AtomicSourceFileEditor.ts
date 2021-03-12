import * as vscode from "vscode";
import { SourceFile } from "./SourceFile";
import { SourceFilePosition } from "./SourceFilePosition";
import { SourceFileRange } from "./SourceFileRange";

// export interface SourceFileEditContext {
//     editor: AtomicSourceFileEditor;
//     // vscodeEditBuilder: vscode.TextEditorEdit;
// } 

export type SourceFileEdit = (editBuilder: vscode.TextEditorEdit) => void;
export type SourceFileEditProvider = (editor: AtomicSourceFileEditor) => Promise<void>;

// export interface SourceFileEditProvider {
//     provide(): Promise<SourceFileEdit>;
// }

/**
 * Wrap a source file edit or a function returning a promise that will resolve to an edit in a provider.
 */
// export function createProviderFor(editProvider: () => Promise<SourceFileEdit>): SourceFileEditProvider;
// export function createProviderFor(edit: SourceFileEdit): SourceFileEditProvider;
// export function createProviderFor(editOrEditProvider: SourceFileEdit | (() => Promise<SourceFileEdit>)): SourceFileEditProvider {
//     // return {
//     //     provide: () => Promise.resolve(editOrEditProvider)
//     // };
//     return Promise.resolve(editOrEditProvider);
// }

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
        // const editsWrappedInProviders = edits.map(edit => createProviderFor(edit));
        // this.editProviders.push(...editsWrappedInProviders);
        this.edits.push(...edits);
    }

    insert(position: SourceFilePosition, text: string): void {
        // this.addEdits(({ vscodeEditBuilder }) => vscodeEditBuilder.insert(position.asVscodePosition, text));
        this.edits.push(editBuilder => editBuilder.insert(position.asVscodePosition, text));
    }

    replace(range: SourceFileRange, text: string): void {
        // this.addEdits(({ vscodeEditBuilder }) => vscodeEditBuilder.replace(range.asVscodeRange, text));
        this.edits.push(editBuilder => editBuilder.replace(range.asVscodeRange, text));
    }

    delete(range: SourceFileRange): void {
        // this.addEdits(({ vscodeEditBuilder }) => {
        //     vscodeEditBuilder.delete(range.asVscodeRange);
        //     console.log("del range", range);
        // });
        this.edits.push(editBuilder => editBuilder.delete(range.asVscodeRange));
    }

    async apply(): Promise<void> {
        const editor = await this.sourceFile.getOrOpenInEditor();
        // await Promise.all(this.editProviders.map(provider => provider.provide()));
        for (let editProvider of this.editProviders) {
            await editProvider(this);
        }

        const success = await editor.edit(editBuilder => {
            // for (let edit of edits) {
            //     edit({
            //         editor: this,
            //         // vscodeEditBuilder: editBuilder
            //     });
            // }
            for (let edit of this.edits) {
                edit(editBuilder);
            }
        });

        if (!success) {
            console.warn("One of the following edits could not be performed (the whole batch failed):", this.edits);
        }

    //     // If there is a single edit, add undo stops both before and after the edit
    //     // If there is more than one edit, add an undo stop before the first edit
    //     // and another one after the last edit (but none in between)
    //     if (this.edits.length === 1) {
    //         await editor.edit(this.edits[0]);
    //     }
    //     else {
    //         const firstEdit = this.edits.shift()!;
    //         const lastEdit = this.edits.pop()!;
    //         const otherEdits = this.edits;

    //         await editor.edit(firstEdit, { undoStopBefore: true, undoStopAfter: false});
    //         for (let edit of otherEdits) {
    //             await editor.edit(edit, { undoStopBefore: false, undoStopAfter: false});
    //         }
    //         await editor.edit(lastEdit, { undoStopBefore: false, undoStopAfter: true});
    //     }
    }
}