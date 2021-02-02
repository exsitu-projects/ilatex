import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

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

    toString(): string {
        return `Comment`;
    }
}