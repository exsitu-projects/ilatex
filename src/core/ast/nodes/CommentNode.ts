import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class CommentNode extends ASTNode {
    static readonly type = "comment" as const;
    static readonly parser = latexParsers.comment;

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

    toString(): string {
        return `Comment`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitCommentNode(this, depth);
    }
}