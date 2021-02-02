import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

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

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}