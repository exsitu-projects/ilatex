import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class ParameterValueNode extends ASTNode {
    static readonly type = "parameter-value" as const;

    readonly type = ParameterValueNode.type;
    readonly value: string;
    protected parser: ASTNodeParser<ParameterValueNode>;
    protected readonly isLeaf = true;

    constructor(
        value: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterValueNode>
    ) {
        super(context);

        this.value = value;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Parameter value [${this.value}]`;
    }

    protected async updateWith(reparsedNode: ParameterValueNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.value = reparsedNode.value;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterValueNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterValueNode(this, depth);
    }
}