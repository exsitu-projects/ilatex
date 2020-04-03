import * as P from "parsimmon";
import { LatexASTVisitor } from "./visitors/LatexASTVisitor";


/** Possible types of an AST node. */
export enum ASTNodeType {
    Latex = "Latex",
    Text = "Text",
    Whitespace = "Whitespace",
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
    ParameterList = "ParameterList",
    SpecialSymbol = "SpecialSymbol",
    Comment = "Comment"
}

/** Possible types of AST node values. */
export type ASTNodeValue =
| string
| ASTMathValue
| ASTAssignmentValue
| ASTParameterListValue
| ASTCommandValue
| ASTEnvironementValue
| ASTNode
| ASTNode[];

export type ASTMathValue = (string | ASTCommentNode)[];

export type ASTAssignmentValue = {
    key: ASTParameterKeyNode,
    value: ASTParameterValueNode
};

export type ASTParameterListValue = (ASTParameterNode | ASTParameterAssignmentNode)[];

export type ASTCommandValue = {
    name: string,
    parameters: (ASTParameterNode[] | ASTParameterListNode[])[]
};

export type ASTEnvironementValue = {
    begin: ASTCommandNode,
    parameters: (ASTParameterNode[] | ASTParameterListNode[])[];
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

    visitWith(visitor: LatexASTVisitor, depth: number = 0, maxDepth: number = Number.MAX_SAFE_INTEGER): void {
        // Visit this node
        visitor.visit(this, depth);

        const childDepth = depth + 1;
        if (childDepth > maxDepth) {
            return;
        }

        // Visit the subtree(s) rooted in this node (if any)
        const type = this.type;
        if (type === ASTNodeType.Command) {
            const root = this as ASTCommandNode;
            
            for (let parameterNodeArray of root.value.parameters) {
                // Absent optional parameters yield zero-length arrays
                // Therefore, they should be ignored during the tree visit
                if (parameterNodeArray.length === 1) {
                    parameterNodeArray[0].visitWith(visitor, childDepth, maxDepth);
                }
            }    
        }
        else if (type === ASTNodeType.Environement) {
            const root = this as ASTEnvironementNode;
            root.value.begin.visitWith(visitor, childDepth, maxDepth);

            for (let parameterNodeArray of root.value.parameters) {
                // Absent optional parameters yield zero-length arrays
                // Therefore, they should be ignored during the tree visit
                if (parameterNodeArray.length === 1) {
                    parameterNodeArray[0].visitWith(visitor, childDepth, maxDepth);
                }
            }

            root.value.content.visitWith(visitor, childDepth, maxDepth);
            root.value.end.visitWith(visitor, childDepth, maxDepth);
        }
        else if (type === ASTNodeType.Block
             ||  type === ASTNodeType.InlineMathBlock
             ||  type === ASTNodeType.MathBlock
             ||  type === ASTNodeType.CurlyBracesParameterBlock
             ||  type === ASTNodeType.SquareBracesParameterBlock) {
            const root = this.value as ASTNode;
            root.visitWith(visitor, childDepth, maxDepth);
        }
        else if (type === ASTNodeType.Latex
             ||  type === ASTNodeType.ParameterList) {
            for (let root of this.value as ASTNode[]) {
                root.visitWith(visitor, childDepth, maxDepth);
            }  
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

export type ASTWhitespaceNode = ASTNode<
    ASTNodeType.Whitespace,
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
    ASTParameterListNode
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

export type ASTParameterListNode = ASTNode<
    ASTNodeType.ParameterList,
    ASTParameterListValue
>;

export type ASTSpecialSymbolNode = ASTNode<
    ASTNodeType.SpecialSymbol,
    string
>;

export type ASTCommentNode = ASTNode<
    ASTNodeType.Comment,
    string
>;