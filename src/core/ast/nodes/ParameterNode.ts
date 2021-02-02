import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class ParameterNode extends ASTNode {
    static readonly type = "parameter" as const;
    static readonly parser = latexParsers.parameter;

    readonly type = ParameterNode.type;
    readonly parser = ParameterNode.parser;
    readonly value: string;

    constructor(
        value: string,
        range: RangeInFile
    ) {
        super(range);
        this.value = value;
    }
    
    toString(): string {
        return `Parameter [${this.value}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterNode(this, depth);
    }
}