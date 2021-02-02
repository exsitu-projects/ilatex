import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterValueNode } from "./ParameterValueNode";
import { ParameterAssignmentNode } from "./ParameterAssignmentNode";

export class ParameterListNode extends ASTNode {
    static readonly type = "parameter-list" as const;
    static readonly parser = latexParsers.parameterList;

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
    
    toString(): string {
        return `Parameter list`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterListNode(this, depth);

        for (let parameterNode of this.parameters) {
            parameterNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}