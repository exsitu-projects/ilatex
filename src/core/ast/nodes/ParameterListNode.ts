import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ParameterValueNode } from "./ParameterValueNode";
import { ParameterAssignmentNode } from "./ParameterAssignmentNode";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";

export class ParameterListNode extends ASTNode {
    static readonly type = "parameter-list" as const;

    readonly type = ParameterListNode.type;
    readonly parameters: (ParameterValueNode | ParameterAssignmentNode)[];
    protected parser: ASTNodeParser<ParameterListNode>;
    protected readonly isLeaf = false;

    constructor(
        parameters: (ParameterValueNode | ParameterAssignmentNode)[],
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterListNode>
    ) {
        super(context);

        this.parameters = parameters;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [...this.parameters];
    }
    
    toString(): string {
        return `Parameter list`;
    }

    protected async updateWith(reparsedNode: ParameterListNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.parameters = reparsedNode.parameters;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterListNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterListNode(this, depth);
    }
}