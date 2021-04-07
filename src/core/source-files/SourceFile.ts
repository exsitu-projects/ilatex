import * as vscode from "vscode";
import * as path from "path";
import { LatexAST } from "../ast/LatexAST";
import { SourceFileChange } from "./SourceFileChange";
import { SourceFileRange } from "../source-files/SourceFileRange";
import { EditableSection, LightweightSourceFileEditor } from "./LightweightSourceFileEditor";
import { AtomicSourceFileEditor, SourceFileEdit, SourceFileEditProvider } from "./AtomicSourceFileEditor";
import { ASTParsingError } from "../ast/ASTParser";

export class NotInitialisedError {}

export type SourceFileChangeProcessingResult = {
    processedByAst: boolean;
    changeIsLoggable: boolean;
};

export class SourceFile {
    readonly uri: vscode.Uri;
    readonly name: string;
    private latexAst: LatexAST | null;
    private hasUnsavedChanges: boolean;

    // Note: if changes are ignored, they will not be logged either!
    ignoreChanges: boolean;
    skipChangeLogging: boolean;

    astNodeParsingErrorEventEmitter: vscode.EventEmitter<ASTParsingError>;

    astNodeParsingErrorEventObserverDisposable: vscode.Disposable | null;

    private constructor(absolutePath: string) {
        this.uri = vscode.Uri.file(absolutePath);
        this.name = path.basename(absolutePath);
        this.latexAst = null;
        this.hasUnsavedChanges = false;

        this.ignoreChanges = false;
        this.skipChangeLogging = false;

        this.astNodeParsingErrorEventEmitter = new vscode.EventEmitter();

        this.astNodeParsingErrorEventObserverDisposable = null;
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

    async selectRangeInEditor(range: SourceFileRange, scrollIfNotVisible: boolean = true): Promise<void> {
        const editor = await this.getOrOpenInEditor();

        // If the selected range is not visible, possibly scroll to the selection
        editor.revealRange(
            range.asVscodeRange,
            scrollIfNotVisible
                ? vscode.TextEditorRevealType.InCenterIfOutsideViewport
                : undefined
        );
    }

    async getContent(range?: SourceFileRange): Promise<string> {
        const document = await this.document;
        return document.getText(range?.asVscodeRange);
    }

    async applyEdits(...edits: SourceFileEdit[]): Promise<void> {
        const editor = this.createAtomicEditor();
        editor.addEdits(...edits);
        await editor.apply();
    }

    createAtomicEditor(editProviders: SourceFileEditProvider[] = []): AtomicSourceFileEditor {
        return new AtomicSourceFileEditor(this, editProviders);
    }

    createLightweightEditorFor(editableSections: EditableSection[]): LightweightSourceFileEditor {
        return new LightweightSourceFileEditor(this, editableSections);
    }

    async parseNewAST(): Promise<void> {
        this.astNodeParsingErrorEventObserverDisposable?.dispose();
        this.latexAst = new LatexAST(this);
        this.astNodeParsingErrorEventObserverDisposable =
            this.latexAst.parsingErrorEventEmitter.event(parsingError => {
                this.astNodeParsingErrorEventEmitter.fire(parsingError);
                vscode.window.showWarningMessage(
                    `File '${this.name}' could not be parsed by iLaTeX\n(code visualisations will not be available in this file).`
                );
            });

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

    async processChange(change: SourceFileChange): Promise<SourceFileChangeProcessingResult> {
        this.hasUnsavedChanges = true;
        
        if (this.latexAst && !this.ignoreChanges) {
            await this.latexAst.processSourceFileChange(change);
            return {
                processedByAst: true,
                changeIsLoggable: !this.skipChangeLogging
            };
        }

        return {
            processedByAst: false,
            changeIsLoggable: false
        };
    }

    async processSave(): Promise<void> {
        await this.parseNewAST();
        this.hasUnsavedChanges = false;
    }

    dispose(): void {
        this.astNodeParsingErrorEventObserverDisposable?.dispose();
    }

    static async fromAbsolutePath(absolutePath: string): Promise<SourceFile> {
        const newSourceFile = new SourceFile(absolutePath);
        await newSourceFile.init();

        return newSourceFile;
    }
}