import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";


export class LatexNode extends ASTNode {
    static readonly type = "latex" as const;
    static readonly parser = latexParsers.latex;

    readonly type = LatexNode.type;
    readonly parser = LatexNode.parser;
    readonly content: ASTNode[];

    constructor(
        content: ASTNode[],
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }
    
    toString(): string {
        return `Latex`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitLatexNode(this, depth);

        for (let contentNode of this.content) {
            contentNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}