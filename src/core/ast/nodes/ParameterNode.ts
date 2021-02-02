import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

export class ParameterNode extends ASTNode {
    static readonly type = "parameter" as const;
    static readonly parser = (text: string) => language.block;

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
}