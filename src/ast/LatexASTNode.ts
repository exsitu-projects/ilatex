import * as P from "parsimmon";


/** Possible types of an AST node. */
export enum ASTNodeType {
    Latex = "Latex",
    Text = "Text",
    Environement = "Environement",
    Command = "Command",
    Math = "Math",
    InlineMathBlock = "InlineMathBlock",
    MathBlock = "MathBlock",
    Block = "Block",
    CurlyBracesParameterBlock = "CurlyBracesParameterBlock",
    Parameter = "Parameter",
    SquareBracesParameterBlock = "SquareBracesParameterBlock",
    ParameterKey = "ParameterKey",
    ParameterValue = "ParameterValue",
    ParameterAssigment = "ParameterAssigment",
    ParameterAssigments = "ParameterAssigments",
    SpecialSymbol = "SpecialSymbol",
    Comment = "Comment"
}

/** Possible types of AST node values. */
export type ASTNodeValue =
| string
| ASTMathValue
| ASTAssignmentValue
| ASTCommandValue
| ASTEnvironementValue
| ASTNode
| ASTNode[];

export type ASTMathValue = (string | ASTCommentNode)[];

export type ASTAssignmentValue = {
    key: ASTParameterKeyNode,
    value: ASTParameterValueNode
};

export type ASTCommandValue = {
    name: string,
    parameters: (ASTParameterNode[] | ASTParameterAssigmentsNode[])[]
};

export type ASTEnvironementValue = {
    begin: ASTCommandNode,
    parameters: (ASTParameterNode[] | ASTParameterAssigmentsNode[])[];
    content: ASTNode,
    end: ASTCommandNode
};

/** Generic interface of an AST node. */
export interface ASTNode<
    T extends ASTNodeType = ASTNodeType,
    V extends ASTNodeValue = ASTNodeValue
>{
    name: string,
    type: T,
    value: V,
    start: P.Index,
    end: P.Index
}

// Specific AST node interfaces
export type ASTLatexNode = ASTNode<
    ASTNodeType.Latex,
    ASTNode[]
>;

export type ASTTextNode = ASTNode<
    ASTNodeType.Text,
    string
>;

export type ASTEnvironementNode = ASTNode<
    ASTNodeType.Environement,
    ASTEnvironementValue
>;

export type ASTCommandNode = ASTNode<
    ASTNodeType.Command,
    ASTCommandValue
>;

export type ASTMathNode = ASTNode<
    ASTNodeType.Math,
    ASTMathValue
>;

export type ASTInlineMathBlockNode = ASTNode<
    ASTNodeType.InlineMathBlock,
    ASTMathNode
>;

export type ASTMathBlockNode = ASTNode<
    ASTNodeType.MathBlock,
    ASTMathNode
>;

export type ASTBlockNode = ASTNode<
    ASTNodeType.Block,
    ASTLatexNode
>;

export type ASTCurlyBracesParameterBlock = ASTNode<
    ASTNodeType.CurlyBracesParameterBlock,
    ASTParameterNode
>;

export type ASTParameterNode = ASTNode<
    ASTNodeType.Parameter,
    string
>;

export type ASTSquareBracesParameterBlock = ASTNode<
    ASTNodeType.SquareBracesParameterBlock,
    ASTParameterAssigmentsNode
>;

export type ASTParameterKeyNode = ASTNode<
    ASTNodeType.ParameterKey,
    string
>;

export type ASTParameterValueNode = ASTNode<
    ASTNodeType.ParameterValue,
    string
>;

export type ASTParameterAssigmentNode = ASTNode<
    ASTNodeType.ParameterAssigment,
    ASTAssignmentValue
>;

export type ASTParameterAssigmentsNode = ASTNode<
    ASTNodeType.ParameterAssigments,
    ASTParameterAssigmentNode[]
>;

export type ASTSpecialSymbolNode = ASTNode<
    ASTNodeType.SpecialSymbol,
    string
>;

export type ASTCommentNode = ASTNode<
    ASTNodeType.Comment,
    string
>;