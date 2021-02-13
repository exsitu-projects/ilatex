import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class SpecialSymbolNode extends ASTNode {
    static readonly type = "special-symbol" as const;

    readonly type = SpecialSymbolNode.type;
    readonly symbol: string;
    protected parser: ASTNodeParser<SpecialSymbolNode>;
    protected readonly isLeaf = true;

    constructor(
        symbol: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<SpecialSymbolNode>
    ) {
        super(context);

        this.symbol = symbol;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Special symbol [${this.symbol}]`;
    }

    protected async updateWith(reparsedNode: SpecialSymbolNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.symbol = reparsedNode.symbol;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitSpecialSymbolNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitSpecialSymbolNode(this, depth);
    }
}