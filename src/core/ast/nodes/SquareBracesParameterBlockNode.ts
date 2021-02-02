import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterNode } from "./ParameterNode";
import { ParameterListNode } from "./ParameterListNode";

export class SquareBracesParameterBlockNode extends ASTNode {
    static readonly type = "square-braces-parameter-block" as const;
    static readonly parser = latexParsers.squareBracesParameterBlock;

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
    
    toString(): string {
        return `[] parameter`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitSquareBracesParameterBlockNode(this, depth);

        this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}