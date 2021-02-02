import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class ParameterKeyNode extends ASTNode {
    static readonly type = "parameter-key" as const;
    static readonly parser = latexParsers.parameterKey;

    readonly type = ParameterKeyNode.type;
    readonly parser = ParameterKeyNode.parser;
    readonly name: string;

    constructor(
        name: string,
        range: RangeInFile
    ) {
        super(range);
        this.name = name;
    }
    
    toString(): string {
        return `Parameter key [${this.name}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterKeyNode(this, depth);
    }
}