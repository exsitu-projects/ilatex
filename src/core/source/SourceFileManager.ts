import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ExtensionFileReader } from "../utils/FileReader";
import { SourceFile } from "./SourceFile";
import { CodeToPDFAnnotationMapping } from "./CodeToPDFAnnotationMapping";

export class NoWorkspaceError {}
export class NoLatexGeneratedMappingFileError {}

export class SourceFileManager {
    readonly sourceFiles: SourceFile[];

    constructor() {
        this.sourceFiles = SourceFileManager.createSourceFilesFromLatexGeneratedMappings();
        console.log("Source files:", this.sourceFiles);
    }

    private static get codeToPDFAnnotationMappingPath(): string {
        if (!vscode.workspace.workspaceFolders
        ||  vscode.workspace.workspaceFolders.length < 1) {
            console.error("A workspace is required to resolve the path to the code-to-PDF annotations mapping file.");
            throw new NoWorkspaceError();
        }

        return path.join(vscode.workspace.workspaceFolders![0].uri.path, "/.ilatex-mappings");
    }

    private static get codeToPDFAnnotationMappingExists(): boolean {
        return fs.existsSync(this.codeToPDFAnnotationMappingPath);
    }
    
    private static readLatexGeneratedMappingFile(): string {
        if (!this.codeToPDFAnnotationMappingExists) {
            console.error("The code-to-PDF annotations mapping file could not be found.");
            throw new NoLatexGeneratedMappingFileError();
        }

        return ExtensionFileReader
            .readExtensionFile(this.codeToPDFAnnotationMappingPath)
            .content;
    }

    private static createSourceFilesFromLatexGeneratedMappings(): SourceFile[] {
        const mappingsAsText = SourceFileManager.readLatexGeneratedMappingFile();

        // The filter operation is used to remove the last string returned by split
        // since it is always empty (it originates from the separator following the last mapping)
        const mappings = mappingsAsText
            .split("---\n")
            .filter(mappingAsText => mappingAsText.length > 0)
            .map(CodeToPDFAnnotationMapping.fromLatexGeneratedMapping);

        const uniqueFiles = new Set(mappings.map(mapping => mapping.sourceFile));
        return [...uniqueFiles.values()]
            .map(uniqueFilePath => {
                return new SourceFile(
                    uniqueFilePath,
                    mappings.filter(mapping => mapping.sourceFile === uniqueFilePath)    
                );
            });
    }
}