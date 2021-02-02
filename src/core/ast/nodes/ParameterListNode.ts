import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";
import { ParameterValueNode } from "./ParameterValueNode";
import { ParameterAssignmentNode } from "./ParameterAssignmentNode";

export class ParameterListNode extends ASTNode {
    static readonly type = "parameter-list" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = ParameterListNode.type;
    readonly parser = ParameterListNode.parser;
    readonly parameters: (ParameterValueNode | ParameterAssignmentNode)[];

    constructor(
        parameters: (ParameterValueNode | ParameterAssignmentNode)[],
        range: RangeInFile
    ) {
        super(range);
        this.parameters = parameters;
    }

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}