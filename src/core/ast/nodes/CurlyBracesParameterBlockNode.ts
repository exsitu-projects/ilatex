import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterListNode } from "./ParameterListNode";
import { ParameterNode } from "./ParameterNode";

export class CurlyBracesParameterBlockNode extends ASTNode {
    static readonly type = "curly-braces-parameter-block" as const;

    readonly type = CurlyBracesParameterBlockNode.type;
    readonly content: ParameterNode | ParameterListNode;
    protected parser: ASTNodeParser<CurlyBracesParameterBlockNode>;

    constructor(
        content: ParameterNode | ParameterListNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<CurlyBracesParameterBlockNode>
    ) {
        super(context);
        
        this.content = content;
        this.parser = parser;
    }
    
    toString(): string {
        return `{} parameter`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitCurlyBracesParameterBlockNode(this, depth);

        this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}