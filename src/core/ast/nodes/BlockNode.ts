import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

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

    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitBlockNode(this, depth);

        for (let contentNode of this.content) {
            await contentNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}