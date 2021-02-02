import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class LatexNode extends ASTNode {
    static readonly type = "latex" as const;
    static readonly parser = (text: string) => language.block;

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

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}