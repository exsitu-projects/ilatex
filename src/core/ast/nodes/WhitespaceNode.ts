import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTAsyncVisitor, ASTSyncVisitor } from "../visitors/visitors";

export class WhitespaceNode extends ASTNode {
    static readonly type = "whitespace" as const;

    readonly type = WhitespaceNode.type;
    protected parser: ASTNodeParser<WhitespaceNode>;

    constructor(
        context: ASTNodeContext,
        parser: ASTNodeParser<WhitespaceNode>
    ) {
        super(context);

        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Whitespace`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitWhitespaceNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitWhitespaceNode(this, depth);
    }
}