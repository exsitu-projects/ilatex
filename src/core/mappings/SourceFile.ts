import * as vscode from "vscode";
import { LatexAST } from "../ast/LatexAST";

export class NotInitialisedError {}

export class SourceFile {
    readonly absolutePath: string;

    private cachedDocument: vscode.TextDocument | null;
    private cachedAst: LatexAST | null;

    constructor(absolutePath: string) {
        this.absolutePath = absolutePath;

        this.cachedDocument = null;
        this.cachedAst = null;
    }

    get document(): vscode.TextDocument {
        if (!this.cachedDocument) {
            console.error("The document of the source file cannot be retrieved if the latter has not been initialised.");
            throw new NotInitialisedError();
        }

        if (this.cachedDocument.isClosed) {
            console.warn("The requested document is closed. It is not synchronised anymore!");
        }

        return this.cachedDocument;
    }

    get editor(): vscode.TextEditor | null {
        return vscode.window.visibleTextEditors.find(editor => {
            return editor.document.uri.path === this.absolutePath;
        }) ?? null;
    }

    get isDisplayedInEditor(): boolean {
        return this.editor !== null;
    }

    get ast(): LatexAST {
        if (!this.cachedAst) {
            console.error("The AST of the source file cannot be retrieved if the latter has not been initialised.");
            throw new NotInitialisedError();
        }

        return this.cachedAst;
    }

    async displayInEditor(): Promise<vscode.TextEditor> {
        if (!this.document) {
            console.error("The source file cannot be displayed in the editor if the latter has not been initialised.");
            throw new NotInitialisedError();
        }
        
        return vscode.window.showTextDocument(this.document, vscode.ViewColumn.One);
    }

    async getOrDisplayInEditor(): Promise<vscode.TextEditor> {
        return this.editor ?? await this.displayInEditor();
    }

    private async openAsDocument(): Promise<vscode.TextDocument> {
        return vscode.workspace.openTextDocument(this.absolutePath);
    }

    private parseDocument(): LatexAST {
        return new LatexAST(this.cachedDocument!.getText());
    }

    async openAndParseDocument(): Promise<void> {
        this.cachedDocument = await this.openAsDocument();
        this.cachedAst = this.parseDocument();
    }

    async saveDocument(): Promise<void> {
        const document = this.document;
        if (!document.isDirty) {
            return;
        }

        const success = await this.document.save();
        console.log(`${this.absolutePath} has been saved`);
        if (!success) {
            console.error("An error occured when trying to save the source file.");
        }
    }
}