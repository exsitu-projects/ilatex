import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterValueNode } from "./ParameterValueNode";
import { ParameterAssignmentNode } from "./ParameterAssignmentNode";

export class ParameterListNode extends ASTNode {
    static readonly type = "parameter-list" as const;

    readonly type = ParameterListNode.type;
    readonly parameters: (ParameterValueNode | ParameterAssignmentNode)[];
    protected parser: ASTNodeParser<ParameterListNode>;

    constructor(
        parameters: (ParameterValueNode | ParameterAssignmentNode)[],
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterListNode>
    ) {
        super(context);

        this.parameters = parameters;
        this.parser = parser;
    }
    
    toString(): string {
        return `Parameter list`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterListNode(this, depth);

        for (let parameterNode of this.parameters) {
            parameterNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}