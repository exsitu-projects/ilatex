import { SourceFile } from "./SourceFile";

export type CodeMappingID = number;

export class MissingMappingFieldError {}

export class CodeMapping {
    readonly type: string;
    readonly sourceFile: SourceFile;
    readonly lineNumber: number;
    readonly id: CodeMappingID;

    private constructor(
        type: string,
        sourceFile: SourceFile,
        lineNumber: number,
        id: number
    ) {
        this.type = type;
        this.sourceFile = sourceFile;
        this.lineNumber = lineNumber;
        this.id = id;
    }

    static fromLatexGeneratedMapping(mappingAsString: string, sourceFiles: SourceFile[]): CodeMapping {
        const mappingEntries = mappingAsString
            .split("\n")
            .map(singleLine => {
                const firstSpaceIndex = singleLine.indexOf(" ");
                return {
                    key: singleLine.substring(0, firstSpaceIndex),
                    value: singleLine.substring(firstSpaceIndex + 1),
                };
            });

        function getEntryValueOrFail(key: string): string {
            const entry = mappingEntries.find(entry => entry.key === key);
            if (!entry) {
                console.error(`No mapping entry "${key}" could be found in the given entry.`);
                throw new MissingMappingFieldError();
            }

            return entry.value;
        }

        const absolutePath = getEntryValueOrFail("abspath");
        let sourceFile = sourceFiles.find(sourceFile =>
            sourceFile.absolutePath === absolutePath
        ) ?? new SourceFile(absolutePath);

        return new CodeMapping(
            getEntryValueOrFail("type"),
            sourceFile,
            parseInt(getEntryValueOrFail("line")),
            parseInt(getEntryValueOrFail("id"))
        );
    }
}