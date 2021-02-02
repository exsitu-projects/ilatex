import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class ParameterValueNode extends ASTNode {
    static readonly type = "parameter-value" as const;

    readonly type = ParameterValueNode.type;
    readonly value: string;
    protected parser: ASTNodeParser<ParameterValueNode>;

    constructor(
        value: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterValueNode>
    ) {
        super(context);

        this.value = value;
        this.parser = parser;
    }
    
    toString(): string {
        return `Parameter value [${this.value}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterValueNode(this, depth);
    }
}