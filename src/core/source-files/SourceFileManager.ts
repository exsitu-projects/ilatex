import * as vscode from "vscode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { SourceFile } from "./SourceFile";
import { SourceFileChange } from "./SourceFileChange";
import { SourceFilePosition } from "./SourceFilePosition";
import { SourceFileRange } from "./SourceFileRange";


export class SourceFileManager {
    private ilatex: InteractiveLatex;
    private files: SourceFile[];

    readonly sourceFileChangeEventEmitter: vscode.EventEmitter<SourceFile>;
    readonly sourceFileSaveEventEmitter: vscode.EventEmitter<SourceFile>;

    private sourceFilesToParsingErrorObserverDisposables: Map<SourceFile, vscode.Disposable>;
    private textDocumentChangeObserverDisposable: vscode.Disposable;
    private textDocumentSaveObserverDisposable: vscode.Disposable;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        this.files = [];

        this.sourceFileChangeEventEmitter = new vscode.EventEmitter();
        this.sourceFileSaveEventEmitter = new vscode.EventEmitter();

        this.sourceFilesToParsingErrorObserverDisposables = new Map();

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
        for (let disposable of this.sourceFilesToParsingErrorObserverDisposables.values()) {
            disposable.dispose();
        }

        this.textDocumentChangeObserverDisposable.dispose();
        this.textDocumentSaveObserverDisposable.dispose();

        for (let sourceFile of this.sourceFiles) {
            sourceFile.dispose();
        }
    }

    async saveAllSourceFiles(): Promise<void> {
        await Promise.all(
            this.sourceFiles.map(sourceFile => sourceFile.save())
        );
    }

    async updateSourceFilesFromCodeMappings(): Promise<void> {
        const absolutePathsOfCurrentSourceFiles = this.files.map(file => file.uri.path);
        const absolutePathsOfCodeMappings = new Set(
            this.ilatex.codeMappingManager.codeMappings.map(codeMapping => codeMapping.absolutePath)
        );

        // Remove source files whose paths do not appear in the new set of code mappings' paths
        // Stop observing parsing errors in those files
        const sourceFilesToRemove = this.files.filter(sourceFile => !absolutePathsOfCodeMappings.has(sourceFile.uri.path));
        for (let sourceFile of sourceFilesToRemove) {
            this.sourceFilesToParsingErrorObserverDisposables.delete(sourceFile);
        }

        this.files = this.files.filter(sourceFile => absolutePathsOfCodeMappings.has(sourceFile.uri.path));

        // Update source files whose path appear in both the new set of code mappings' paths
        // and in the paths of the current source files, i.e. those that have not been deleted just above
        for (let sourceFile of this.sourceFiles) {
            await sourceFile.parseNewAST();
        }
        
        // Create new source files from paths that appear in the new set of code mappings' paths
        // but not in the paths of the current source files
        for (let path of absolutePathsOfCodeMappings) {
            if (absolutePathsOfCurrentSourceFiles.includes(path)) {
                continue;
            }

            const newSourceFile = await SourceFile.fromAbsolutePath(path);
            this.files.push(newSourceFile);

            // Start observing parsing errors in these files
            this.sourceFilesToParsingErrorObserverDisposables.set(
                newSourceFile,
                newSourceFile.astNodeParsingErrorEventEmitter.event(parsingError => {
                    this.ilatex.logFileManager.logError({
                        event: "parsing-error",
                        fileName: newSourceFile.name
                    });
                })
            );
        }

        // console.log("New list of source files: ", this.files);
    }


    private async processTextDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        const sourceFileInChangedDocument = this.sourceFiles.find(
            sourceFile => sourceFile.isRepresentedByDocument(event.document)
        );

        if (sourceFileInChangedDocument) {
            for (let contentChange of event.contentChanges) {
                const sourceFileChange = new SourceFileChange(contentChange);
                const changeProcessingResult = await sourceFileInChangedDocument.processChange(sourceFileChange);

                if (changeProcessingResult.changeIsLoggable) {
                    const editedVisualisationModel = this.ilatex.visualisationModelManager.findModelContainingRange(new SourceFileRange(
                        SourceFilePosition.fromVscodePosition(sourceFileChange.start),
                        SourceFilePosition.fromVscodePosition(sourceFileChange.end)
                    ));

                    let editedVisualisationDataToLog = {};
                    if (editedVisualisationModel) {
                        editedVisualisationDataToLog = {
                            visualisationName: editedVisualisationModel.name,
                            visualisationUid: editedVisualisationModel.uid,
                            visualisationCodeMappingId: editedVisualisationModel.codeMapping.id,
                        };
                    }

                    this.ilatex.logFileManager.logUserEditEvent({
                        fileName: sourceFileInChangedDocument.name,
                        event: "text-edit",
                        editKind: sourceFileChange.kind.toLowerCase(),
                        editSize: sourceFileChange.size,

                        ...editedVisualisationDataToLog
                    });
                }
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