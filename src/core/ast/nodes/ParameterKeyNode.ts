import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";

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
    
    toString(): string {
        return `Parameter key [${this.name}]`;
    }
}