import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class BlockNode extends ASTNode {
    static readonly type = "block" as const;

    readonly type = BlockNode.type;
    readonly content: ASTNode[];
    protected parser: ASTNodeParser<BlockNode>;

    constructor(
        content: ASTNode[],
        context: ASTNodeContext,
        parser: ASTNodeParser<BlockNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [...this.content];
    }

    toString(): string {
        return `Block`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        const indexOfCurrentChildNode = this.content.indexOf(currentChildNode);
        if (indexOfCurrentChildNode >= 0) {
            this.stopObservingChildNode(currentChildNode);
            this.content.splice(indexOfCurrentChildNode, 1, newChildNode);
            this.startObservingChildNode(newChildNode);
        }
        else {
            console.error(`AST node replacement failed (in node ${this.toString()}): the current child node was not found.`);
        }
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitBlockNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitBlockNode(this, depth);
    }
}