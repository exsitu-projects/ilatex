import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterNode } from "./ParameterNode";
import { ParameterListNode } from "./ParameterListNode";

export class SquareBracesParameterBlockNode extends ASTNode {
    static readonly type = "square-braces-parameter-block" as const;

    readonly type = SquareBracesParameterBlockNode.type;
    readonly content: ParameterNode | ParameterListNode;
    protected parser: ASTNodeParser<SquareBracesParameterBlockNode>;

    constructor(
        content: ParameterNode | ParameterListNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<SquareBracesParameterBlockNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
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