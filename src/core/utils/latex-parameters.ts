import { any } from "parsimmon";
import { LatexLength } from "../../shared/latex-length/LatexLength";
import { ParameterAssignmentNode } from "../ast/nodes/ParameterAssignmentNode";
import { ParameterNode } from "../ast/nodes/ParameterNode";

/** Unit of raw length parameter values (that normally are LatexLength objects). */
export const RAW_LATEX_PARAMETER_DIMENSION_UNIT = "px";

export type LatexParameterAstNode = ParameterNode | ParameterAssignmentNode;

export abstract class LatexParameter<
    Value,
    RawValue,
    Node extends LatexParameterAstNode = LatexParameterAstNode
> {
    readonly value: Value;
    readonly astNode: Node;

    constructor(
        value: Value,
        astNode: Node
    ) {
        this.value = value;
        this.astNode = astNode;
    }

    /** Value of the parameter converted to a standard, serialisable JS type. */
    abstract readonly rawValue: RawValue;
};

/** Type of the raw value of the given LatexParameter type parameter. */
export type RawValueOf<T extends { rawValue: any; }> = T["rawValue"];

export class BooleanParameter<
    Node extends LatexParameterAstNode = LatexParameterAstNode
> extends LatexParameter<boolean, boolean, Node> {
    get rawValue(): boolean {
        return this.value;
    }
}

export class NumericParameter<
    Node extends LatexParameterAstNode = LatexParameterAstNode
> extends LatexParameter<number, number, Node> {
    get rawValue(): number {
        return this.value;
    }
}

export class TextParameter<
    Node extends LatexParameterAstNode = LatexParameterAstNode
> extends LatexParameter<string, string, Node> {
    get rawValue(): string {
        return this.value;
    }
}

export class LengthParameter<
    Node extends LatexParameterAstNode = LatexParameterAstNode
> extends LatexParameter<LatexLength, number, Node> {
    get rawValue(): number {
        return this.value.px;
    }
}