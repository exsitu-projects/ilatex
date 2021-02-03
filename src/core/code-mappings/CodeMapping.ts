import { LatexLengthCustomSettings } from "../../shared/latex-length/LatexLengthSettings";

export type CodeMappingID = number;

// The context of a code mapping is the value of certain "things"
// in the LaTeX engine at the beginning of mapped code extract
// (e.g. the value of a length macro such as \linewidth)
export interface CodeMappingContext {
    // The values of variable length units and length macros are given in points (pt)
    readonly variableLengthUnitValues: Record<string, number>;
    readonly lengthMacrosValues: Record<string, number>;

    // The list of paths used by the graphicx package to search for images
    readonly graphicsPaths: string[];
}

export class MissingMappingFieldError {}

export class CodeMapping {
    readonly type: string;
    readonly absolutePath: string;
    readonly lineNumber: number;
    readonly id: CodeMappingID;

    readonly context: CodeMappingContext;

    private constructor(
        type: string,
        absolutePath: string,
        lineNumber: number,
        id: number,
        context: CodeMappingContext
    ) {
        this.type = type;
        this.absolutePath = absolutePath;
        this.lineNumber = lineNumber;
        this.id = id;

        this.context = context;
    }

    get localLatexLengthSettings(): LatexLengthCustomSettings {
        return {
            variableUnitsValues: this.context.variableLengthUnitValues,
            lengthMacroValues: this.context.lengthMacrosValues
        };
    }

    static fromLatexGeneratedMapping(mappingAsString: string): CodeMapping {
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
                console.error(`No entry "${key}" could be found in the given code mapping.`);
                throw new MissingMappingFieldError();
            }

            return entry.value;
        }

        function getAllLengthValuesWithPrefix(prefix: string, newKeyPrefix: string = ""): Record<string, number> {
            return Object.fromEntries(
                mappingEntries
                    .filter(entry => entry.key.startsWith(prefix))
                    .map(entry => [
                        entry.key.replace(prefix, newKeyPrefix),
                        parseFloat(entry.value)
                    ])
            );
        }

        // We extract various contextual entries to build a context object
        const context = {
            variableLengthUnitValues: getAllLengthValuesWithPrefix("length_unit_"),
            lengthMacrosValues: getAllLengthValuesWithPrefix("length_macro_", "\\"),

            // Multiple graphics paths are specified by enclosing them
            // in successive curly-braces blocks (with no other separator).
            // We split the paths to make a list out of them
            // and make sure to remove all the curly braces from the blocks.
            graphicsPaths: getEntryValueOrFail("graphicspath")
                .split(/\}\s*\{/)
                .map(dirtyPath => dirtyPath.replace(/^\{|\}$/g, ""))
        };

        return new CodeMapping(
            getEntryValueOrFail("type"),
            getEntryValueOrFail("path"),
            parseInt(getEntryValueOrFail("line")),
            parseInt(getEntryValueOrFail("id")),
            context
        );
    }
}