import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";
import { MathNode } from "./MathNode";

export class DisplayMathNode extends ASTNode {
    static readonly type = "display-math" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = DisplayMathNode.type;
    readonly parser = DisplayMathNode.parser;
    readonly content: MathNode;

    constructor(
        content: MathNode,
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