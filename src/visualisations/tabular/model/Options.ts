import * as P from "parsimmon";
import { ASTEnvironementNode, ASTParameterNode } from "../../../core/ast/LatexASTNode";

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

export class Options {
    readonly columnTypes: readonly string[];

    private constructor(columnTypes: string[]) {
        this.columnTypes = columnTypes;
    }

    private static extractColumnTypesFrom(parameterNode: ASTParameterNode): string[] {
        let columnTypes: string[] = [];
        try {
            columnTypes = columnTypesLanguage.columns
                .tryParse(parameterNode.value);
        }
        catch (error) {
            console.error("An error occured during the parsing of tabular options:", error);
        }

        return columnTypes;
    }

    static extractFrom(tabularNode: ASTEnvironementNode): Options {
        const parameterNode = tabularNode.value.parameters[0][0] as ASTParameterNode;
        return new Options(
            Options.extractColumnTypesFrom(parameterNode)
        );
    }
}