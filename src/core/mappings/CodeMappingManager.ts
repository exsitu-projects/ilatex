import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { ExtensionFileReader } from "../utils/FileReader";
import { SourceFile } from "./SourceFile";
import { CodeMapping } from "./CodeMapping";
import { TaskDebouncer } from "../../shared/tasks/TaskDebouncer";

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

    private get latexGeneratedMappingFilePath(): string {
        return path.join(
            path.dirname(this.ilatex.mainSourceFileUri.path),
            path.basename(this.ilatex.mainSourceFileUri.path, ".tex").concat(".ilatex-mappings")
        );
    }

    private get latexGeneratedMappingFileExists(): boolean {
        return fs.existsSync(this.latexGeneratedMappingFilePath);
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

    private readLatexGeneratedMappingFile(): string {
        if (!this.latexGeneratedMappingFileExists) {
            console.error("The code-to-PDF annotations mapping file could not be found.");
            throw new NoLatexGeneratedMappingFileError();
        }

        return ExtensionFileReader
            .readExtensionFile(this.latexGeneratedMappingFilePath)
            .content;
    }

    private createMappingsFromLatexGeneratedFile(): CodeMapping[] {
        // If no mapping file can be found, assume there is none (and therefore no mapping)
        if (!this.latexGeneratedMappingFileExists) {
            console.info("The code-to-PDF annotations mapping file could not be found: no mapping will be created.");
            return [];
        }

        const mappingsAsText = this.readLatexGeneratedMappingFile();
        
        // The filter operation is used to remove the last string returned by split
        // since it is always empty (it originates from the separator following the last mapping)
        const sourceFiles: SourceFile[] = [];
        return mappingsAsText
            .split("---\n")
            .filter(mappingAsText => mappingAsText.length > 0)
            .map(mappingAsText => CodeMapping.fromLatexGeneratedMapping(
                mappingAsText,
                path.dirname(this.ilatex.mainSourceFileUri.path),
                sourceFiles
            ));
    }

    getMappingsWith(absolutePath: string, type?: string, lineNumber?: number): CodeMapping[] {
        return this.mappings.filter(mapping =>
                mapping.sourceFile.absolutePath === absolutePath
            && (type === undefined || (mapping.type === type))
            && (lineNumber === undefined || (mapping.lineNumber === lineNumber))
        );
    }

    hasMappingWith(absolutePath: string, type?: string, lineNumber?: number): boolean {
        return this.getMappingsWith(absolutePath, type, lineNumber).length > 0;
    }

    async readAndParseAllSourceFiles(): Promise<void> {
        await Promise.all(this.mappings.map(mapping => mapping.sourceFile.openAndParseDocument()));
    }

    async updateMappingsFromLatexGeneratedFile(): Promise<void> {
        this.stopObservingSourceFileChanges();

        this.mappings = this.createMappingsFromLatexGeneratedFile();
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
}