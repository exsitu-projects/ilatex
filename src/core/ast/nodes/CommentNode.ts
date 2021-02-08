import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class CommentNode extends ASTNode {
    static readonly type = "comment" as const;

    readonly type = CommentNode.type;
    readonly content: string;
    protected parser: ASTNodeParser<CommentNode>;

    constructor(
        content: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<CommentNode>
    ) {
        super(context);

        this.content = content.substring(1); // Ignore the percent sign
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }

    toString(): string {
        return `Comment`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitCommentNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitCommentNode(this, depth);
    }
}