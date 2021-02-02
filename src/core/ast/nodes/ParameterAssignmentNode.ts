import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterKeyNode } from "./ParameterKeyNode";
import { ParameterValueNode } from "./ParameterValueNode";

export class ParameterAssignmentNode extends ASTNode {
    static readonly type = "parameter-assignment" as const;
    static readonly parser = latexParsers.parameterAssignment;

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
    
    toString(): string {
        return `Parameter assignment [${this.key.name} = ${this.value.value}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterAssignmentNode(this, depth);
        this.key.visitWith(visitor, depth + 1, maxDepth);
        this.value.visitWith(visitor, depth + 1, maxDepth);
    };
}