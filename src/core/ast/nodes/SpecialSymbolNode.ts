import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";


export class SpecialSymbolNode extends ASTNode {
    static readonly type = "special-symbol" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = SpecialSymbolNode.type;
    readonly parser = SpecialSymbolNode.parser;
    readonly symbol: string;

    constructor(
        symbol: string,
        range: RangeInFile
    ) {
        super(range);
        this.symbol = symbol;
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