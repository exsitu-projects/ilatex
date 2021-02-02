import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class ParameterNode extends ASTNode {
    static readonly type = "parameter" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = ParameterNode.type;
    readonly parser = ParameterNode.parser;
    readonly value: string;

    constructor(
        value: string,
        range: RangeInFile
    ) {
        super(range);
        this.value = value;
    }

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}