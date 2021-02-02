import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

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
    
    toString(): string {
        return `Parameter value [${this.value}]`;
    }
}