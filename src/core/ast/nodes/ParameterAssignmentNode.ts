import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ParameterKeyNode } from "./ParameterKeyNode";
import { ParameterValueNode } from "./ParameterValueNode";

export class ParameterAssignmentNode extends ASTNode {
    static readonly type = "parameter-assignment" as const;

    readonly type = ParameterAssignmentNode.type;
    readonly key: ParameterKeyNode;
    readonly value: ParameterValueNode;
    protected parser: ASTNodeParser<ParameterAssignmentNode>;
    protected readonly isLeaf = false;

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

    get childNodes(): ASTNode[] {
        return [this.key, this.value];
    }
    
    toString(): string {
        return `Parameter assignment [${this.key.name} = ${this.value.value}]`;
    }

    protected async updateWith(reparsedNode: ParameterAssignmentNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.key = reparsedNode.key;
        writeableSelf.value = reparsedNode.value;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterAssignmentNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterAssignmentNode(this, depth);
    }
}