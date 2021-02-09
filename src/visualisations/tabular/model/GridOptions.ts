import * as P from "parsimmon";
import { CurlyBracesParameterBlockNode } from "../../../core/ast/nodes/CurlyBracesParameterBlockNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { ParameterNode } from "../../../core/ast/nodes/ParameterNode";

// Based on https://en.wikibooks.org/wiki/LaTeX/Tables#The_tabular_environment
// Support the most common values for the required parameter of tabular
const columnTypesLanguage = P.createLanguage<{
    alignedColumn: string,
    sizedColumn: string,
    otherCharacter: null,
    columns: string[]
}>({
    alignedColumn: lang => {
        return P.oneOf("lcr");
    },

    sizedColumn: lang => {
        return P.seq(
            P.oneOf("pmb"),
            P.string("{"),
            P.regex(/[^\}]/),
            P.string("}")
        ).tie();
    },

    otherCharacter: lang => {
        return P.noneOf("lcrpmb")
            .map(() => null);
    },

    columns: lang => {
        return P.alt(
           lang.alignedColumn,
           lang.sizedColumn,
           lang.otherCharacter
        )
            .atLeast(1)
            .map(columns => columns.filter(c => c !== null) as string[]);
    }
});

export class GridOptions {
    private columnTypesParameterBlockNode: CurlyBracesParameterBlockNode;
    readonly columnTypes: readonly string[];

    private constructor(columnTypesParameterBlockNode: CurlyBracesParameterBlockNode) {
        this.columnTypesParameterBlockNode = columnTypesParameterBlockNode;
        this.columnTypes = this.extractColumnTypes();
    }

    private extractColumnTypes(): string[] {
        const parameterNode = this.columnTypesParameterBlockNode.content as ParameterNode;
        const result = columnTypesLanguage.columns.parse(parameterNode.value);

        return result.status
            ? result.value
            : [];
    }

    static async from(tabularNode: EnvironmentNode): Promise<GridOptions> {
        return new GridOptions(
            tabularNode.parameters[0] as CurlyBracesParameterBlockNode
        );
    }
}