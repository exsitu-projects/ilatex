import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { MathNode } from "./MathNode";

export class InlineMathNode extends ASTNode {
    static readonly type = "inline-math" as const;

    readonly type = InlineMathNode.type;
    readonly content: MathNode;
    protected parser: ASTNodeParser<InlineMathNode>;

    constructor(
        content: MathNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<InlineMathNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }
    
    toString(): string {
        return `Inline math`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitInlineMathNode(this, depth);

        this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}