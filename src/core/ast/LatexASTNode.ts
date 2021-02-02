import * as vscode from "vscode";
import * as P from "parsimmon";
import { LatexASTVisitor } from "./visitors/LatexASTVisitor";
import { PositionInFile } from "../utils/PositionInFile";
import { RangeInFile } from "../utils/RangeInFile";
import { SourceFileChange } from "../mappings/SourceFileChange";
import { SourceFile } from "../mappings/SourceFile";


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
| (ASTNode | ASTEmptyValue)
| ASTNode[];

export const AST_EMPTY_VALUE: unique symbol = Symbol("Empty AST value");
export type ASTEmptyValue = typeof AST_EMPTY_VALUE;

export type ASTMathValue = (string | ASTCommentNode)[];

export type ASTAssignmentValue = {
    key: ASTParameterKeyNode,
    value: ASTParameterValueNode
};

export type ASTParameterListValue = (ASTParameterNode | ASTParameterAssignmentNode)[];

export type ASTCommandValue = {
    name: string,
    nameStart: P.Index; 
    nameEnd: P.Index; 
    parameters: (ASTParameterNode | ASTParameterListNode)[][]
};

export type ASTEnvironementValue = {
    begin: ASTCommandNode,
    parameters: (ASTParameterNode | ASTParameterListNode)[][],
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
    readonly range: RangeInFile;

    private hasBeenEditedWithinItsRange: boolean;
    private hasBeenEditedAcrossItsRange: boolean;

    readonly beforeNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;
    readonly withinNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;
    readonly acrossNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;

    constructor(
        name: string,
        type: T,
        value: V,
        start: P.Index,
        end: P.Index
    ) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.range = new RangeInFile(
            PositionInFile.fromParsimmonIndex(start),
            PositionInFile.fromParsimmonIndex(end)
        );

        this.hasBeenEditedWithinItsRange = false;
        this.hasBeenEditedAcrossItsRange = false;

        this.beforeNodeUserEditEventEmitter = new vscode.EventEmitter();
        this.withinNodeUserEditEventEmitter = new vscode.EventEmitter();
        this.acrossNodeUserEditEventEmitter = new vscode.EventEmitter();
    }

    get hasBeenEditedByTheUser(): boolean {
        return this.hasBeenEditedWithinItsRange
            || this.hasBeenEditedAcrossItsRange;
    }

    processSourceFileEdit(change: SourceFileChange): void {
        const nodeStart = this.range.from.asVscodePosition;
        const nodeEnd = this.range.to.asVscodePosition;

        // Case 1: the node ends strictly before the modified range.
        if (nodeEnd.isBefore(change.start)) {
            // In this case, the node is completely unaffected: there is nothing to do.
            return;
        }

        // Case 2: the node starts stricly after the modified range.
        else if (nodeStart.isAfter(change.end)) {
            this.processUserEditBeforeNode(change);
        }

        // Case 3: the modified range overlaps with the range of the node.
        else if (change.event.range.intersection(this.range.asVscodeRange)) {
            // Case 3.1: the modified range is contained within the node
            if (change.start.isAfterOrEqual(nodeStart) && change.end.isBeforeOrEqual(nodeEnd)) {
                this.processUserEditWitihinNode(change);
            }

            // Case 3.2: a part of the modified range is outside the range of the node
            else {
                this.processUserEditAcrossNode(change);
            }
        }

        else {
            console.error("Unexpected case in processSourceFileEdit():", change, this);
        }
    }

    private processUserEditBeforeNode(change: SourceFileChange): void {
        this.range.from.shift.lines += change.shift.lines;
        this.range.from.shift.offset += change.shift.offset;

        this.range.to.shift.lines += change.shift.lines;
        this.range.to.shift.offset += change.shift.offset;

        // Special case: the node starts on the same line than the last line of the modified range
        if (this.range.from.asVscodePosition.line === change.end.line) {
            // In this particular case, the column must also be shifted!
            // It can either concern the start column only or both the start and end columns
            // (if the end column is located on the same line than the start column)
            this.range.from.shift.columns += change.shift.columns;
            if (this.range.isSingleLine) {
                this.range.to.shift.columns += change.shift.columns;
            }
        }

        this.beforeNodeUserEditEventEmitter.fire(change);
    }

    private processUserEditWitihinNode(change: SourceFileChange): void {
        this.range.to.shift.lines += change.shift.lines;
        this.range.to.shift.offset += change.shift.offset;  

        // If the change ends on the same line than the node end,
        // the column of the node end must also be shifted
        if (change.end.line === this.range.from.asVscodePosition.line) {
            this.range.to.shift.columns += change.shift.columns;
        }

        // this.hasUnhandledEdits = true;
        this.hasBeenEditedWithinItsRange = true;
        this.withinNodeUserEditEventEmitter.fire(change);
    }

    private processUserEditAcrossNode(change: SourceFileChange): void {
        // this.hasUnhandledEdits = true;
        this.hasBeenEditedAcrossItsRange = true;
        this.acrossNodeUserEditEventEmitter.fire(change);
    }

    async getContentIn(sourceFile: SourceFile): Promise<string> {
        return sourceFile.document.getText(this.range.asVscodeRange);
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
            // If the block is empty, do not attempt to visit its (non-existinbg) content    
            if (this.value === AST_EMPTY_VALUE) {
                return;
            }

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
    (ASTLatexNode | typeof AST_EMPTY_VALUE)
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