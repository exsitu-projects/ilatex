import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class SpecialSymbolNode extends ASTNode {
    static readonly type = "special-symbol" as const;

    readonly type = SpecialSymbolNode.type;
    readonly symbol: string;
    protected parser: ASTNodeParser<SpecialSymbolNode>;

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

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitSpecialSymbolNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitSpecialSymbolNode(this, depth);
    }
}