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

    toString(): string {
        return `Block`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitBlockNode(this, depth);

        for (let contentNode of this.content) {
            contentNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}