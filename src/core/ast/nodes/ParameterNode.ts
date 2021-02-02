import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class ParameterNode extends ASTNode {
    static readonly type = "parameter" as const;

    readonly type = ParameterNode.type;
    readonly value: string;
    protected parser: ASTNodeParser<ParameterNode>;

    constructor(
        value: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterNode>
    ) {
        super(context);

        this.value = value;
        this.parser = parser;
    }
    
    toString(): string {
        return `Parameter [${this.value}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterNode(this, depth);
    }
}