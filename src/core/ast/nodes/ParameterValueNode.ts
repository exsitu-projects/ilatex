import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class ParameterValueNode extends ASTNode {
    static readonly type = "parameter-value" as const;
    static readonly parser = (text: string) => language.block;

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

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}