import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class ParameterNode extends ASTNode {
    static readonly type = "parameter" as const;

    readonly type = ParameterNode.type;
    readonly value: string;
    protected parser: ASTNodeParser<ParameterNode>;
    protected readonly isLeaf = true;

    constructor(
        value: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterNode>
    ) {
        super(context);

        this.value = value;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Parameter [${this.value}]`;
    }

    protected async updateWith(reparsedNode: ParameterNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.value = reparsedNode.value;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterNode(this, depth);
    }
}