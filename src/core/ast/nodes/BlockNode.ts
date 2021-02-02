import * as P from "parsimmon";
import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class BlockNode<Content = ASTNode[]> extends ASTNode {
    static readonly type = "block" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = BlockNode.type;
    readonly parser = BlockNode.parser;
    readonly content: Content;

    constructor(
        content: Content,
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