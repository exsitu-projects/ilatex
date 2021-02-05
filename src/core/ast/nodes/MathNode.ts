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

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Math`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        if (depth > maxDepth) {
            return;
        }
        
        await visitor.visitMathNode(this, depth);
    }
}