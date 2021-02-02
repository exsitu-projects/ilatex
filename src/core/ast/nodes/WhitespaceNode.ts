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
    
    toString(): string {
        return `Whitespace`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitWhitespaceNode(this, depth);
    }
}