import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterKeyNode } from "./ParameterKeyNode";
import { ParameterValueNode } from "./ParameterValueNode";

export class ParameterAssignmentNode extends ASTNode {
    static readonly type = "parameter-assignment" as const;

    readonly type = ParameterAssignmentNode.type;
    readonly key: ParameterKeyNode;
    readonly value: ParameterValueNode;
    protected parser: ASTNodeParser<ParameterAssignmentNode>;

    constructor(
        key: ParameterKeyNode,
        value: ParameterValueNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterAssignmentNode>
    ) {
        super(context);

        this.key = key;
        this.value = value;
        this.parser = parser;
    }
    
    toString(): string {
        return `Parameter assignment [${this.key.name} = ${this.value.value}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterAssignmentNode(this, depth);
        this.key.visitWith(visitor, depth + 1, maxDepth);
        this.value.visitWith(visitor, depth + 1, maxDepth);
    };
}