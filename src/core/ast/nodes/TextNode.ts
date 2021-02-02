import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class TextNode extends ASTNode {
    static readonly type = "text" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = TextNode.type;
    readonly parser = TextNode.parser;
    readonly content: string;

    constructor(
        content: string,
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }
    
    toString(): string {
        return `Text`;
    }
}