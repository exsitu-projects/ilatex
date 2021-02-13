import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";


export class LatexNode extends ASTNode {
    static readonly type = "latex" as const;

    readonly type = LatexNode.type;
    readonly content: ASTNode[];
    protected parser: ASTNodeParser<LatexNode>;
    protected readonly isLeaf = false;

    constructor(
        content: ASTNode[],
        context: ASTNodeContext,
        parser: ASTNodeParser<LatexNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [...this.content];
    }
    
    toString(): string {
        return `Latex`;
    }

    protected async updateWith(reparsedNode: LatexNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.content = reparsedNode.content;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitLatexNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitLatexNode(this, depth);
    }
}