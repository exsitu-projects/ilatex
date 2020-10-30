import { CodeToPDFAnnotationMapping } from "./CodeToPDFAnnotationMapping";
import * as vscode from "vscode";
import { LatexAST } from "../ast/LatexAST";

export class NotInitialisedError {}

export class SourceFile {
    readonly absolutePath: string;
    readonly mappings: CodeToPDFAnnotationMapping[];

    private document: vscode.TextDocument | null;
    private documentAst: LatexAST | null;

    constructor(absolutePath: string, mappings: CodeToPDFAnnotationMapping[]) {
        this.absolutePath = absolutePath;
        this.mappings = mappings;

        this.document = null;
        this.documentAst = null;
    }

    async init(): Promise<void> {
        this.document = await this.openAsTextDocument();
        this.documentAst = this.parse();
    }

    get ast(): LatexAST {
        if (!this.documentAst) {
            console.error("The AST of the source file cannot be retrieved if the latter has not been initialised.");
            throw new NotInitialisedError();
        }

        return this.documentAst;
    }

    get editor(): vscode.TextEditor | null {
        return vscode.window.visibleTextEditors.find(editor => {
            console.log("Comparing paths:", editor.document.uri.path, this.absolutePath);
            return editor.document.uri.path === this.absolutePath;
        }) ?? null;
    }

    get isDisplayedInEditor(): boolean {
        return this.editor !== null;
    }

    async displayInEditor(): Promise<vscode.TextEditor> {
        if (!this.document) {
            console.error("The source file cannot be displayed in the editor if the latter has not been initialised.");
            throw new NotInitialisedError();
        }
        
        return vscode.window.showTextDocument(this.document, vscode.ViewColumn.One);
    }

    private async openAsTextDocument(): Promise<vscode.TextDocument> {
        return vscode.workspace.openTextDocument(this.absolutePath);
    }

    private parse(): LatexAST {
        return new LatexAST(this.document!.getText());
    }
}