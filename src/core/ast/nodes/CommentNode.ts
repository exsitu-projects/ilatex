import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class CommentNode extends ASTNode {
    static readonly type = "comment" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = CommentNode.type;
    readonly parser = CommentNode.parser;
    readonly content: string;

    constructor(
        content: string,
        range: RangeInFile
    ) {
        super(range);
        this.content = content.substring(1); // Ignore the percent sign
    }

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}