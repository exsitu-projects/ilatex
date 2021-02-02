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
    
    toString(): string {
        return `Special symbol [${this.symbol}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitSpecialSymbolNode(this, depth);
    }
}