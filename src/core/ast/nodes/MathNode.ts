import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class MathNode extends ASTNode {
    static readonly type = "math" as const;
    static readonly parser = (text: string) => language.block;

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

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}