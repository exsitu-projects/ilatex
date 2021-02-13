import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { MathNode } from "./MathNode";

export class DisplayMathNode extends ASTNode {
    static readonly type = "display-math" as const;

    readonly type = DisplayMathNode.type;
    readonly content: MathNode;
    protected parser: ASTNodeParser<DisplayMathNode>;
    protected readonly isLeaf = false;

    constructor(
        content: MathNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<DisplayMathNode>
    ) {
        super(context);
        
        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.content];
    }
    
    toString(): string {
        return `Display math`;
    }

    protected async updateWith(reparsedNode: DisplayMathNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.content = reparsedNode.content;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitDisplayMathNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitDisplayMathNode(this, depth);
    }
}