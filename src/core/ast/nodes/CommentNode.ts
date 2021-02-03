import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { ASTVisitor } from "../visitors/ASTVisitor";

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

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitCommentNode(this, depth);
    }
}