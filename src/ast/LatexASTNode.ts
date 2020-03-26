import * as P from "parsimmon";
import { LatexASTVisitor } from "./visitors/LatexASTVisitor";


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
    ParameterAssignment = "ParameterAssignment",
    ParameterAssignments = "ParameterAssignments",
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
    parameters: (ASTParameterNode[] | ASTParameterAssignmentsNode[])[]
};

export type ASTEnvironementValue = {
    begin: ASTCommandNode,
    parameters: (ASTParameterNode[] | ASTParameterAssignmentsNode[])[];
    content: ASTNode,
    end: ASTCommandNode
};

/** Generic interface of an AST node. */
export class ASTNode<
    T extends ASTNodeType = ASTNodeType,
    V extends ASTNodeValue = ASTNodeValue
>{
    readonly name: string;
    readonly type: T;
    readonly value: V;
    readonly start: P.Index;
    readonly end: P.Index;

    constructor(name: string, type: T, value: V, start: P.Index, end: P.Index) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.start = start;
        this.end = end;
    }

    visitWith(visitor: LatexASTVisitor, depth: number = 0): void {
        // Visit this node
        visitor.visit(this, depth);

        // Visit the subtree(s) rooted in this node (if any)
        const type = this.type;
        if (type === ASTNodeType.Command) {
            const root = this as ASTCommandNode;
            
            for (let parameterNodeArray of root.value.parameters) {
                // Absent optional parameters yield zero-length arrays
                // Therefore, they should be ignored during the tree visit
                if (parameterNodeArray.length === 1) {
                    parameterNodeArray[0].visitWith(visitor, depth + 1);
                }
            }    
        }
        else if (type === ASTNodeType.Environement) {
            const root = this as ASTEnvironementNode;
            root.value.begin.visitWith(visitor, depth + 1);

            for (let parameterNodeArray of root.value.parameters) {
                // Absent optional parameters yield zero-length arrays
                // Therefore, they should be ignored during the tree visit
                if (parameterNodeArray.length === 1) {
                    parameterNodeArray[0].visitWith(visitor, depth + 1);
                }
            }

            root.value.content.visitWith(visitor, depth + 1);
            root.value.end.visitWith(visitor, depth + 1);
        }
        else if (type === ASTNodeType.Block
             ||  type === ASTNodeType.InlineMathBlock
             ||  type === ASTNodeType.MathBlock
             ||  type === ASTNodeType.CurlyBracesParameterBlock
             ||  type === ASTNodeType.SquareBracesParameterBlock) {
            const root = this.value as ASTNode;
            root.visitWith(visitor, depth + 1);
        }
        else if (type === ASTNodeType.Latex
             ||  type === ASTNodeType.ParameterAssignments) {
            for (let root of this.value as ASTNode[]) {
                root.visitWith(visitor, depth + 1);
            }  
        }
        else /* string values */ {
            // Nothing to do
        }
    }
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
    ASTParameterAssignmentsNode
>;

export type ASTParameterKeyNode = ASTNode<
    ASTNodeType.ParameterKey,
    string
>;

export type ASTParameterValueNode = ASTNode<
    ASTNodeType.ParameterValue,
    string
>;

export type ASTParameterAssignmentNode = ASTNode<
    ASTNodeType.ParameterAssignment,
    ASTAssignmentValue
>;

export type ASTParameterAssignmentsNode = ASTNode<
    ASTNodeType.ParameterAssignments,
    ASTParameterAssignmentNode[]
>;

export type ASTSpecialSymbolNode = ASTNode<
    ASTNodeType.SpecialSymbol,
    string
>;

export type ASTCommentNode = ASTNode<
    ASTNodeType.Comment,
    string
>;