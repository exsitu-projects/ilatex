import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterListNode } from "./ParameterListNode";
import { ParameterNode } from "./ParameterNode";

export class CurlyBracesParameterBlockNode extends ASTNode {
    static readonly type = "curly-braces-parameter-block" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = CurlyBracesParameterBlockNode.type;
    readonly parser = CurlyBracesParameterBlockNode.parser;
    readonly content: ParameterNode | ParameterListNode;

    constructor(
        content: ParameterNode | ParameterListNode,
        range: RangeInFile
    ) {
        super(range);
        this.content = content;
    }
    
    toString(): string {
        return `{} parameter`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitCurlyBracesParameterBlockNode(this, depth);

        this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}