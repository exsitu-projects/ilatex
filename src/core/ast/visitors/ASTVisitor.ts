import { BlockNode } from "../nodes/BlockNode";
import { CommandNode } from "../nodes/CommandNode";
import { CommentNode } from "../nodes/CommentNode";
import { CurlyBracesParameterBlockNode } from "../nodes/CurlyBracesParameterBlockNode";
import { DisplayMathNode } from "../nodes/DisplayMathNode";
import { EnvironmentNode } from "../nodes/EnvironmentNode";
import { InlineMathNode } from "../nodes/InlineMathNode";
import { LatexNode } from "../nodes/LatexNode";
import { MathNode } from "../nodes/MathNode";
import { ParameterAssignmentNode } from "../nodes/ParameterAssignmentNode";
import { ParameterKeyNode } from "../nodes/ParameterKeyNode";
import { ParameterListNode } from "../nodes/ParameterListNode";
import { ParameterNode } from "../nodes/ParameterNode";
import { ParameterValueNode } from "../nodes/ParameterValueNode";
import { SpecialSymbolNode } from "../nodes/SpecialSymbolNode";
import { SquareBracesParameterBlockNode } from "../nodes/SquareBracesParameterBlockNode";
import { TextNode } from "../nodes/TextNode";
import { WhitespaceNode } from "../nodes/WhitespaceNode";

export interface ASTVisitor {
    visitBlockNode(node: BlockNode, depth: number): void;
    visitCommandNode(node: CommandNode, depth: number): void;
    visitCommentNode(node: CommentNode, depth: number): void;
    visitCurlyBracesParameterBlockNode(node: CurlyBracesParameterBlockNode, depth: number): void;
    visitDisplayMathNode(node: DisplayMathNode, depth: number): void;
    visitEnvironmentNode(node: EnvironmentNode, depth: number): void;
    visitInlineMathNode(node: InlineMathNode, depth: number): void;
    visitLatexNode(node: LatexNode, depth: number): void;
    visitMathNode(node: MathNode, depth: number): void;
    visitParameterAssignmentNode(node: ParameterAssignmentNode, depth: number): void;
    visitParameterKeyNode(node: ParameterKeyNode, depth: number): void;
    visitParameterListNode(node: ParameterListNode, depth: number): void;
    visitParameterNode(node: ParameterNode, depth: number): void;
    visitParameterValueNode(node: ParameterValueNode, depth: number): void;
    visitSpecialSymbolNode(node: SpecialSymbolNode, depth: number): void;
    visitSquareBracesParameterBlockNode(node: SquareBracesParameterBlockNode, depth: number): void;
    visitTextNode(node: TextNode, depth: number): void;
    visitWhitespaceNode(node: WhitespaceNode, depth: number): void;
}