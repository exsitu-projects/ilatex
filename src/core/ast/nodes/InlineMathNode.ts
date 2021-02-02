import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { MathNode } from "./MathNode";

export class InlineMathNode extends ASTNode {
    static readonly type = "inline-math" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = InlineMathNode.type;
    readonly parser = InlineMathNode.parser;
    readonly content: MathNode;

    constructor(
        content: MathNode,
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }
    
    toString(): string {
        return `Inline math`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitInlineMathNode(this, depth);

        this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}