import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class WhitespaceNode extends ASTNode {
    static readonly type = "whitespace" as const;
    static readonly parser = latexParsers.whitespace;

    readonly type = WhitespaceNode.type;
    readonly parser = WhitespaceNode.parser;

    constructor(
        range: RangeInFile
    ) {
        super(range);
    }
    
    toString(): string {
        return `Whitespace`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitWhitespaceNode(this, depth);
    }
}