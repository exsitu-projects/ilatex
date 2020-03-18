import * as P from "parsimmon";


/** Possible types of an AST node. */
export enum ASTNodeType {
    Latex = "Latex",
    Text = "Text",
    Environement = "Environement",
    Command = "Command",
    InlineMathBlock = "InlineMathBlock",
    MathBlock = "MathBlock",
    Block = "Block",
    CurlyBracesBlock = "CurlyBracesBlock",
    SquareBracesBlock = "SquareBracesBlock",
    Parameter = "Parameter",
    ParameterKey = "ParameterKey",
    ParameterValue = "ParameterValue",
    ParameterAssigment = "ParameterAssigment",
    SpecialSymbol = "SpecialSymbol",
    Comment = "Comment"
}

/** Common interface of an AST node. */
export interface ASTNode<V> {
    name: string,
    type: ASTNodeType,
    value: V,
    start: P.Index,
    end: P.Index
}