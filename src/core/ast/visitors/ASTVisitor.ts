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
    visitBlockNode(node: BlockNode, depth: number): Promise<void>;
    visitCommandNode(node: CommandNode, depth: number): Promise<void>;
    visitCommentNode(node: CommentNode, depth: number): Promise<void>;
    visitCurlyBracesParameterBlockNode(node: CurlyBracesParameterBlockNode, depth: number): Promise<void>;
    visitDisplayMathNode(node: DisplayMathNode, depth: number): Promise<void>;
    visitEnvironmentNode(node: EnvironmentNode, depth: number): Promise<void>;
    visitInlineMathNode(node: InlineMathNode, depth: number): Promise<void>;
    visitLatexNode(node: LatexNode, depth: number): Promise<void>;
    visitMathNode(node: MathNode, depth: number): Promise<void>;
    visitParameterAssignmentNode(node: ParameterAssignmentNode, depth: number): Promise<void>;
    visitParameterKeyNode(node: ParameterKeyNode, depth: number): Promise<void>;
    visitParameterListNode(node: ParameterListNode, depth: number): Promise<void>;
    visitParameterNode(node: ParameterNode, depth: number): Promise<void>;
    visitParameterValueNode(node: ParameterValueNode, depth: number): Promise<void>;
    visitSpecialSymbolNode(node: SpecialSymbolNode, depth: number): Promise<void>;
    visitSquareBracesParameterBlockNode(node: SquareBracesParameterBlockNode, depth: number): Promise<void>;
    visitTextNode(node: TextNode, depth: number): Promise<void>;
    visitWhitespaceNode(node: WhitespaceNode, depth: number): Promise<void>;
}