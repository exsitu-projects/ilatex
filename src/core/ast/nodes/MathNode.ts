import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

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

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitMathNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitMathNode(this, depth);
    }
}