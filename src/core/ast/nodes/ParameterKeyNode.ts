import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";

export class ParameterKeyNode extends ASTNode {
    static readonly type = "parameter-key" as const;
    static readonly parser = (text: string) => language.block;

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

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}