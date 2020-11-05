import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { ExtensionFileReader } from "../utils/FileReader";
import { SourceFile } from "./SourceFile";
import { CodeMapping } from "./CodeMapping";
import { TaskDebouncer } from "../../shared/tasks/TaskDebouncer";

export class NoWorkspaceError {}
export class NoLatexGeneratedMappingFileError {}

export class CodeMappingManager {
    private static readonly DELAY_BETWEEN_FILE_CHANGE_POLLING = 1000; // ms

    private ilatex: InteractiveLatex;
    private mappings: CodeMapping[];
    private sourceFileChangeWatchers: fs.FSWatcher[];

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        this.mappings = [];
        this.sourceFileChangeWatchers = [];
    }

    get allSourceFiles(): SourceFile[] {
        const uniqueAbsolutePaths = new Set();
        const sourceFiles = [];

        for (let mapping of this.mappings) {
            const absolutePath = mapping.sourceFile.absolutePath;
            if (uniqueAbsolutePaths.has(absolutePath)) {
                continue;
            }

            sourceFiles.push(mapping.sourceFile);
            uniqueAbsolutePaths.add(absolutePath);
        }

        return sourceFiles;
    }

    dispose(): void {
        this.startObservingDocumentChanges();
    }

    getMappingsWith(type: string, absolutePath: string, lineNumber: number): CodeMapping[] {
        return this.mappings.filter(mapping =>
               mapping.type === type
            && mapping.sourceFile.absolutePath === absolutePath
            && mapping.lineNumber === lineNumber    
        );
    }

    hasMappingWith(type: string, absolutePath: string, lineNumber: number): boolean {
        return this.getMappingsWith(type, absolutePath, lineNumber).length > 0;
    }


    async readAndParseAllSourceFiles(): Promise<void> {
        await Promise.all(this.mappings.map(mapping => mapping.sourceFile.openAndParseDocument()));
    }

    async updateMappingsFromLatexGeneratedFile(): Promise<void> {
        this.stopObservingSourceFileChanges();

        this.mappings = CodeMappingManager.createMappingsFromLatexGeneratedFile();
        await this.readAndParseAllSourceFiles();

        this.startObservingDocumentChanges();
    }

    private startObservingDocumentChanges(): void {
        for (let sourceFile of this.allSourceFiles) {
            const sourceFileChangeDebouncer = new TaskDebouncer(
                CodeMappingManager.DELAY_BETWEEN_FILE_CHANGE_POLLING
            );
    
            this.sourceFileChangeWatchers.push(
                fs.watch(sourceFile.absolutePath, (event, filename) => {
                    sourceFileChangeDebouncer.add(async () => {
                        await this.onSourceFileChange();
                    });
                })
            );
        }
    }

    private stopObservingSourceFileChanges(): void {
        for (let watcher of this.sourceFileChangeWatchers) {
            watcher.close();
        }

        this.sourceFileChangeWatchers = [];
    }

    // Every time a source file is modified,
    // both the PDF and the visualisations must be updated
    // (e.g. after saving a modified LaTeX document in VSCode)
    private async onSourceFileChange(): Promise<void> {
        console.log("source file changed ; about to update everything...");
        await this.ilatex.updatePDFAndVisualisations();
    }

    private static get latexGeneratedMappingFilePath(): string {
        if (!vscode.workspace.workspaceFolders
        ||  vscode.workspace.workspaceFolders.length < 1) {
            console.error("A workspace is required to resolve the path to the code-to-PDF annotations mapping file.");
            throw new NoWorkspaceError();
        }

        return path.join(vscode.workspace.workspaceFolders![0].uri.path, "/.ilatex-mappings");
    }

    private static get latexGeneratedMappingFileExists(): boolean {
        return fs.existsSync(CodeMappingManager.latexGeneratedMappingFilePath);
    }
    
    private static readLatexGeneratedMappingFile(): string {
        if (!CodeMappingManager.latexGeneratedMappingFileExists) {
            console.error("The code-to-PDF annotations mapping file could not be found.");
            throw new NoLatexGeneratedMappingFileError();
        }

        return ExtensionFileReader
            .readExtensionFile(CodeMappingManager.latexGeneratedMappingFilePath)
            .content;
    }

    private static createMappingsFromLatexGeneratedFile(): CodeMapping[] {
        const mappingsAsText = CodeMappingManager.readLatexGeneratedMappingFile();
        
        // The filter operation is used to remove the last string returned by split
        // since it is always empty (it originates from the separator following the last mapping)
        const sourceFiles: SourceFile[] = [];
        return mappingsAsText
            .split("---\n")
            .filter(mappingAsText => mappingAsText.length > 0)
            .map(mappingAsText => CodeMapping.fromLatexGeneratedMapping(mappingAsText, sourceFiles));
    }
}