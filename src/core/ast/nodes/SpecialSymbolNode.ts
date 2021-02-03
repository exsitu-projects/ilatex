import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";


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

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitSpecialSymbolNode(this, depth);
    }
}