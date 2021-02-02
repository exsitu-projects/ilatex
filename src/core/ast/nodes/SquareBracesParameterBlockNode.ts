import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";
import { ParameterNode } from "./ParameterNode";
import { ParameterListNode } from "./ParameterListNode";

export class SquareBracesParameterBlockNode extends ASTNode {
    static readonly type = "square-braces-parameter-block" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = SquareBracesParameterBlockNode.type;
    readonly parser = SquareBracesParameterBlockNode.parser;
    readonly content: ParameterNode | ParameterListNode;

    constructor(
        content: ParameterNode | ParameterListNode,
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}