export class MissingMappingFieldError {}

export class CodeToPDFAnnotationMapping {
    readonly type: string;
    readonly sourceFile: string;
    readonly lineNumber: number;
    readonly id: number;

    private constructor(
        type: string,
        sourceFile: string,
        lineNumber: number,
        id: number
    ) {
        this.type = type;
        this.sourceFile = sourceFile;
        this.lineNumber = lineNumber;
        this.id = id;
    }

    static fromLatexGeneratedMapping(mapping: string): CodeToPDFAnnotationMapping {
        const mappingEntries = mapping
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

        return new CodeToPDFAnnotationMapping(
            getEntryValueOrFail("type"),
            getEntryValueOrFail("abspath"),
            parseInt(getEntryValueOrFail("line")),
            parseInt(getEntryValueOrFail("id"))
        );
    }
}