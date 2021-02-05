import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

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

    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        if (depth > maxDepth) {
            return;
        }
        
        await visitor.visitWhitespaceNode(this, depth);
    }
}