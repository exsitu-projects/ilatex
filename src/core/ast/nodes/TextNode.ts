import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class TextNode extends ASTNode {
    static readonly type = "text" as const;

    readonly type = TextNode.type;
    readonly content: string;
    protected parser: ASTNodeParser<TextNode>;

    constructor(
        content: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<TextNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Text`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitTextNode(this, depth);
    }
}