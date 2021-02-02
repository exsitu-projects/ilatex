import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class MathNode extends ASTNode {
    static readonly type = "math" as const;

    readonly type = MathNode.type;
    readonly content: string;
    protected parser: ASTNodeParser<MathNode>;

    constructor(
        content: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<MathNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }
    
    toString(): string {
        return `Math`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitMathNode(this, depth);
    }
}