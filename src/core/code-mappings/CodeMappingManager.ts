import * as fs from "fs";
import * as path from "path";
import { InteractiveLatex } from "../InteractiveLatex";
import { ExtensionFileReader } from "../utils/ExtensionFileReader";
import { CodeMapping } from "./CodeMapping";

export class NoLatexGeneratedMappingFileError {}

export class CodeMappingManager {
    private ilatex: InteractiveLatex;
    private mappings: CodeMapping[];

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        this.mappings = [];
    }

    get codeMappings(): CodeMapping[] {
        return this.mappings;
    }

    private get codeMappingFilePath(): string {
        return path.join(
            path.dirname(this.ilatex.mainSourceFileUri.path),
            path.basename(this.ilatex.mainSourceFileUri.path, ".tex").concat(".ilatex-mappings")
        );
    }

    private get codeMappingFileExists(): boolean {
        return fs.existsSync(this.codeMappingFilePath);
    }

    dispose(): void {
        
    }

    private readCodeMappingFile(): string {
        if (!this.codeMappingFileExists) {
            console.error("The code-to-PDF annotations mapping file could not be found.");
            throw new NoLatexGeneratedMappingFileError();
        }

        return ExtensionFileReader
            .readExtensionFile(this.codeMappingFilePath)
            .content;
    }

    private createNewCodeMappingsFromLatexGeneratedFile(): CodeMapping[] {
        // If no mapping file can be found, assume there is none (and therefore no mapping)
        if (!this.codeMappingFileExists) {
            console.info("The code-to-PDF annotations mapping file could not be found: no mapping will be created.");
            return [];
        }

        const mappingsAsText = this.readCodeMappingFile();
        
        // The first filter operation is used to remove the last string returned by split
        // since it is always empty (it originates from the separator following the last mapping)
        return mappingsAsText
            .split("---\n")
            .filter(mappingAsText => mappingAsText.length > 0)
            .map(mappingAsText => {
                // If a mapping could not be parsed without error, silently skip the mapping
                try {
                    return CodeMapping.fromLatexGeneratedMapping(mappingAsText, this.ilatex.mainSourceFileUri);
                }
                catch (error) {
                    return null;
                }
            })
            .filter(codeMappingOrNull => codeMappingOrNull !== null) as CodeMapping[];
    }

    updateCodeMappingsFromLatexGeneratedFile(): void {
        this.mappings = this.createNewCodeMappingsFromLatexGeneratedFile();
    }
}