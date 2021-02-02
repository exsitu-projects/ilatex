import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";


export class LatexNode extends ASTNode {
    static readonly type = "latex" as const;

    readonly type = LatexNode.type;
    readonly content: ASTNode[];
    protected parser: ASTNodeParser<LatexNode>;

    constructor(
        content: ASTNode[],
        context: ASTNodeContext,
        parser: ASTNodeParser<LatexNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }
    
    toString(): string {
        return `Latex`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitLatexNode(this, depth);

        for (let contentNode of this.content) {
            contentNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}