import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class TextNode extends ASTNode {
    static readonly type = "text" as const;

    readonly type = TextNode.type;
    readonly content: string;
    protected parser: ASTNodeParser<TextNode>;
    protected readonly isLeaf = true;

    constructor(
        content: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<TextNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Text`;
    }

    protected async updateWith(reparsedNode: TextNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.content = reparsedNode.content;
    }


    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitTextNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitTextNode(this, depth);
    }
}