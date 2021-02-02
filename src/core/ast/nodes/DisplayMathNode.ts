import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { MathNode } from "./MathNode";

export class DisplayMathNode extends ASTNode {
    static readonly type = "display-math" as const;

    readonly type = DisplayMathNode.type;
    readonly content: MathNode;
    protected parser: ASTNodeParser<DisplayMathNode>;

    constructor(
        content: MathNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<DisplayMathNode>
    ) {
        super(context);
        
        this.content = content;
        this.parser = parser;
    }
    
    toString(): string {
        return `Display math`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitDisplayMathNode(this, depth);

        this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}