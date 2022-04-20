import * as P from "parsimmon";
import { CurlyBracesParameterBlockNode } from "../../../core/ast/nodes/CurlyBracesParameterBlockNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { ParameterNode } from "../../../core/ast/nodes/ParameterNode";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";

export const enum GridColumnAlignment {
    Left = "Left",
    Center = "Center",
    Right = "Right",
    Unknown = "Unknown"
}

export interface GridColumnSpecification {
    alignment: GridColumnAlignment;
    text: string;
    startIndex: P.Index;
    endIndex: P.Index;
}

const getColumnAlignementFromSpecificationText = (text: string): GridColumnAlignment => {
    const mappingFromFirstCharacter: Record<string, GridColumnAlignment> = {
        "l": GridColumnAlignment.Left,
        "c": GridColumnAlignment.Center,
        "r": GridColumnAlignment.Right,
        "p": GridColumnAlignment.Left,
        "m": GridColumnAlignment.Left,
        "b": GridColumnAlignment.Left
    };

    return text.length === 0
        ? GridColumnAlignment.Unknown
        : mappingFromFirstCharacter[text[0]] ?? GridColumnAlignment.Unknown;
};

const makeGridColumnSpecificationOf = (parser: P.Parser<string>): P.Parser<GridColumnSpecification> => {
    return P.seqMap(P.index, parser, P.index, (startIndex, parserResult, endIndex) => {
        return {
            alignment: getColumnAlignementFromSpecificationText(parserResult),
            text: parserResult,
            startIndex: startIndex,
            endIndex: endIndex
        };
    });
};

// Based on https://en.wikibooks.org/wiki/LaTeX/Tables#The_tabular_environment
// Support the most common values for the required parameter of tabular
const columnSpecificationLanguage = P.createLanguage<{
    regularColumnType: string,
    regularColumn: GridColumnSpecification,
    sizedColumnType: string,
    curlyBracesBlock: string,
    sizedColumn: GridColumnSpecification,
    otherCharacter: null,
    columns: GridColumnSpecification[]
}>({
    regularColumnType: lang => {
        return P.oneOf("lcr");
    },

    regularColumn: lang => {
        return makeGridColumnSpecificationOf(lang.regularColumnType);
    },

    sizedColumnType: lang => {
        return P.oneOf("pmb");
    },

    curlyBracesBlock: lang => {
        // A curly braces block can either contain characters other than { and }
        // or other well-formed curly braces block
        const blockContent = P.alt(
            P.noneOf("{}").many().tie(),
            lang.curlyBracesBlock
        );

        return P.seq(
            P.string("{"),
            blockContent,
            P.string("}")
        ).tie();
    },

    sizedColumn: lang => {
        return makeGridColumnSpecificationOf(
            P.seq(P.oneOf("pmb"), lang.curlyBracesBlock).tie()
        );
    },

    otherCharacter: lang => {
        return P.noneOf("lcrpmb")
            .map(() => null);
    },

    columns: lang => {
        return P.alt(
           lang.regularColumn,
           lang.sizedColumn,
           lang.otherCharacter
        )
            .atLeast(1)
            .map(result => result.filter(c => c !== null) as GridColumnSpecification[]);
    }
});

export class GridOptions {
    readonly columnTypesParameterBlockNode: CurlyBracesParameterBlockNode;
    readonly columnTypesParameterNode: ParameterNode;
    readonly columnSpecifications: readonly GridColumnSpecification[];

    private constructor(columnTypesParameterBlockNode: CurlyBracesParameterBlockNode) {
        this.columnTypesParameterBlockNode = columnTypesParameterBlockNode;
        this.columnTypesParameterNode = this.columnTypesParameterBlockNode.content as ParameterNode;
        this.columnSpecifications = this.extractColumnSpecifications();
    }

    get nbColumnSpecifications(): number {
        return this.columnSpecifications.length;
    }

    hasSpecificationForColumnWithIndex(columnIndex: number): boolean {
        return columnIndex <= this.columnSpecifications.length - 1;
    }

    getSpecificationOfColumnWithIndex(columnIndex: number): GridColumnSpecification | null {
        return this.columnSpecifications[columnIndex] ?? null;
    }

    getSpecificationRangeOfColumnWithIndex(columnIndex: number): SourceFileRange | null {
        const specification = this.getSpecificationOfColumnWithIndex(columnIndex);
        if (!specification) {
            return null;
        }
        
        const start = this.columnTypesParameterNode.range.from.withTranslation({
            line: specification.startIndex.line - 1,
            column: specification.startIndex.column - 1,
        });
        const end = this.columnTypesParameterNode.range.from.withTranslation({
            line: specification.endIndex.line - 1,
            column: specification.endIndex.column - 1,
        });

        return new SourceFileRange(start, end);
    }

    private extractColumnSpecifications(): GridColumnSpecification[] {
        return columnSpecificationLanguage.columns.tryParse(this.columnTypesParameterNode.value);
    }

    static async from(tabularNode: EnvironmentNode): Promise<GridOptions> {
        return new GridOptions(
            tabularNode.parameters[0] as CurlyBracesParameterBlockNode
        );
    }
}