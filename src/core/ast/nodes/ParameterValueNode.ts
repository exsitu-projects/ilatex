import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class ParameterValueNode extends ASTNode {
    static readonly type = "parameter-value" as const;
    static readonly parser = latexParsers.parameterValue;

    readonly type = ParameterValueNode.type;
    readonly parser = ParameterValueNode.parser;
    readonly value: string;

    constructor(
        value: string,
        range: RangeInFile
    ) {
        super(range);
        this.value = value;
    }
    
    toString(): string {
        return `Parameter value [${this.value}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterValueNode(this, depth);
    }
}