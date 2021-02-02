import * as P from "parsimmon";
import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class BlockNode extends ASTNode {
    static readonly type = "block" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = BlockNode.type;
    readonly parser = BlockNode.parser;
    readonly content: ASTNode[];

    constructor(
        content: ASTNode[],
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }

    toString(): string {
        return `Block`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitBlockNode(this, depth);

        for (let contentNode of this.content) {
            contentNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}