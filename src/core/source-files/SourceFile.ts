import * as vscode from "vscode";
import * as path from "path";
import { LatexAST } from "../ast/LatexAST";
import { SourceFileChange } from "./SourceFileChange";
import { RangeInFile } from "../utils/RangeInFile";


export class NotInitialisedError {}

export class SourceFile {
    readonly uri: vscode.Uri;
    readonly name: string;
    private latexAst: LatexAST | null;
    private hasUnsavedChanges: boolean;

    private constructor(absolutePath: string) {
        this.uri = vscode.Uri.file(absolutePath);
        this.name = path.basename(absolutePath);
        this.latexAst = null;
        this.hasUnsavedChanges = false;
    }

    private async init(): Promise<void> {
        // Preload the document in VS Code
        await vscode.workspace.openTextDocument(this.uri.path);

        // Create and initialise the AST
        await this.parseNewAST();
    }

    get isDirty(): boolean {
        return this.hasUnsavedChanges;
    }

    get ast(): LatexAST {
        if (!this.latexAst) {
            throw new NotInitialisedError();
        }

        return this.latexAst;
    }

    get document(): Promise<vscode.TextDocument> {
        return new Promise((resolve, reject) => {
            vscode.workspace
                .openTextDocument(this.uri.path)
                .then(document => resolve(document));
        });
    }

    get editor(): vscode.TextEditor | null {
        return vscode.window.visibleTextEditors.find(editor => {
            return editor.document.uri.path === this.uri.path;
        }) ?? null;
    }

    get isOpenInEditor(): boolean {
        return this.editor !== null;
    }

    isRepresentedByDocument(document: vscode.TextDocument): boolean {
        return this.uri.path === document.uri.path;
    }

    async openInEditor(): Promise<vscode.TextEditor> {
        return vscode.window.showTextDocument(await this.document, vscode.ViewColumn.One);
    }

    async getOrOpenInEditor(): Promise<vscode.TextEditor> {
        return this.editor ?? await this.openInEditor();
    }

    async getContent(range?: RangeInFile): Promise<string> {
        const document = await this.document;
        return document.getText(range?.asVscodeRange);
    }

    async parseNewAST(): Promise<void> {
        this.latexAst = new LatexAST(this);
        await this.latexAst.init();
    }

    async save(): Promise<void> {
        const document = await this.document;
        if (!document.isDirty) {
            return;
        }

        const success = await document.save();
        if (!success) {
            console.error(`An error occured when trying to save a source file (${this.uri.path}).`);
        }
    }

    async processChange(change: SourceFileChange): Promise<void> {
        this.hasUnsavedChanges = true;
        
        if (this.latexAst) {
            this.latexAst.processSourceFileChange(change);
        }
    }

    async processSave(): Promise<void> {
        this.hasUnsavedChanges = false;
    }

    static async fromAbsolutePath(absolutePath: string): Promise<SourceFile> {
        const newSourceFile = new SourceFile(absolutePath);
        await newSourceFile.init();

        return newSourceFile;
    }
}