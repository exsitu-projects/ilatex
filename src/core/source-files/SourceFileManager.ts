import * as vscode from "vscode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { SourceFile } from "./SourceFile";
import { SourceFileChange } from "./SourceFileChange";


export class SourceFileManager {
    private ilatex: InteractiveLatex;
    private files: SourceFile[];

    readonly sourceFileChangeEventEmitter: vscode.EventEmitter<SourceFile>;
    readonly sourceFileSaveEventEmitter: vscode.EventEmitter<SourceFile>;

    private textDocumentChangeObserverDisposable: vscode.Disposable;
    private textDocumentSaveObserverDisposable: vscode.Disposable;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        this.files = [];

        this.sourceFileChangeEventEmitter = new vscode.EventEmitter();
        this.sourceFileSaveEventEmitter = new vscode.EventEmitter();

        this.textDocumentChangeObserverDisposable = vscode.workspace.onDidChangeTextDocument(
            async (event) => await this.processTextDocumentChange(event)
        );

        this.textDocumentSaveObserverDisposable = vscode.workspace.onDidSaveTextDocument(
            async (document) => await this.processTextDocumentSave(document)
        );
    }

    get sourceFiles(): SourceFile[] {
        return this.files;
    }

    get hasDirtySourceFile(): boolean {
        return this.sourceFiles.some(sourceFile => sourceFile.isDirty);
    }

    hasSourceFileWithPath(absolutePath: string): boolean {
        return this.sourceFiles.some(sourceFile => sourceFile.uri.path === absolutePath);
    }

    getSourceFileWithPath(absolutePath: string): SourceFile | undefined {
        return this.sourceFiles.find(sourceFile => sourceFile.uri.path === absolutePath);
    }

    getSourceFileOfCodeMapping(codeMapping: CodeMapping): SourceFile | undefined {
        return this.getSourceFileWithPath(codeMapping.absolutePath);
    }

    dispose() {
        this.textDocumentChangeObserverDisposable.dispose();
        this.textDocumentSaveObserverDisposable.dispose();
    }

    async saveAllSourceFiles(): Promise<void> {
        await Promise.all(
            this.sourceFiles.map(sourceFile => sourceFile.save())
        );
    }

    // TODO: decide what to do with source files
    // whose path do not appear in any code mapping anymore:
    // should they be kept or deleted?
    // For the moment, no source file is ever removed...
    async updateSourceFilesFromCodeMappings(): Promise<void> {
        const codeMappingPathsWithoutSourceFile = this.ilatex.codeMappingManager.codeMappings
            .filter(codeMapping => !this.hasSourceFileWithPath(codeMapping.absolutePath))
            .map(codeMapping => codeMapping.absolutePath);

        for (let absolutePath of codeMappingPathsWithoutSourceFile) {
            const newSourceFile = await SourceFile.fromAbsolutePath(absolutePath);
            this.files.push(newSourceFile);
        }
    }


    private async processTextDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        const sourceFileInChangedDocument = this.sourceFiles.find(
            sourceFile => sourceFile.isRepresentedByDocument(event.document)
        );

        if (sourceFileInChangedDocument) {
            for (let contentChange of event.contentChanges) {
                const sourceFileChange = new SourceFileChange(contentChange);
                await sourceFileInChangedDocument.processChange(sourceFileChange);
            }

            this.sourceFileChangeEventEmitter.fire(sourceFileInChangedDocument);
        }
    }

    private async processTextDocumentSave(document: vscode.TextDocument): Promise<void> {
        const sourceFileInSavedDocument = this.sourceFiles.find(
            sourceFile => sourceFile.isRepresentedByDocument(document)
        );

        if (sourceFileInSavedDocument) {
            await sourceFileInSavedDocument.processSave();
            this.sourceFileSaveEventEmitter.fire(sourceFileInSavedDocument);
        }
    }
}