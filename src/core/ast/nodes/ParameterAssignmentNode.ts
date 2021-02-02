import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";
import { ParameterKeyNode } from "./ParameterKeyNode";
import { ParameterValueNode } from "./ParameterValueNode";

export class ParameterAssignmentNode extends ASTNode {
    static readonly type = "parameter-assignment" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = ParameterAssignmentNode.type;
    readonly parser = ParameterAssignmentNode.parser;
    readonly key: ParameterKeyNode;
    readonly value: ParameterValueNode;

    constructor(
        key: ParameterKeyNode,
        value: ParameterValueNode,
        range: RangeInFile
    ) {
        super(range);
        this.key = key;
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