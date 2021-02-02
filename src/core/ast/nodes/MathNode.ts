import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class MathNode extends ASTNode {
    static readonly type = "math" as const;
    static readonly parser = latexParsers;

    readonly type = MathNode.type;
    readonly parser = MathNode.parser;
    readonly content: string;

    constructor(
        content: string,
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }
    
    toString(): string {
        return `Math`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitMathNode(this, depth);
    }
}