import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { MathNode } from "./MathNode";

export class InlineMathNode extends ASTNode {
    static readonly type = "inline-math" as const;

    readonly type = InlineMathNode.type;
    readonly content: MathNode;
    protected parser: ASTNodeParser<InlineMathNode>;
    protected readonly isLeaf = false;

    constructor(
        content: MathNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<InlineMathNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.content];
    }
    
    toString(): string {
        return `Inline math`;
    }

    protected async updateWith(reparsedNode: InlineMathNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.content = reparsedNode.content;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitInlineMathNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitInlineMathNode(this, depth);
    }
}