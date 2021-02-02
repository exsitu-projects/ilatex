import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class WhitespaceNode extends ASTNode {
    static readonly type = "whitespace" as const;
    static readonly parser = (text: string) => language.block;

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
}