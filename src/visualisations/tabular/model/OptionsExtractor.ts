import * as P from "parsimmon";
import { ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../../../core/ast/visitors/LatexASTVisitorAdapter";
import { LatexLengthOptions } from "../../../core/utils/LatexLength";

export interface Options {
    columnTypes: string[];
}

// Based on https://en.wikibooks.org/wiki/LaTeX/Tables#The_tabular_environment
// Support the most common values for the required parameter of tabular
const TABULAR_COLUMN_TYPES_LANGUAGE = P.createLanguage<{
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

export class OptionsExtractor extends LatexASTVisitorAdapter {
    private static readonly LATEX_LENGTH_OPTIONS: LatexLengthOptions = {
        // big points is the default unit for includegraphics (in graphicx package)
        defaultUnit: "bp"
    };

    readonly options: Options;

    constructor() {
        super();
        this.options = {
            columnTypes: []
        };
    }

    protected visitParameterNode(node: ASTParameterNode): void {
        try {
            this.options.columnTypes = TABULAR_COLUMN_TYPES_LANGUAGE.columns
                .tryParse(node.value);
        }
        catch (error) {
            console.error("An error occured during tabular option parsing:", error);
        }
    }
}