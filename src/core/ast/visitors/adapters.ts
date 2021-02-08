import { ASTAsyncVisitor, ASTSyncVisitor } from "./visitors";
import { ASTNode } from "../nodes/ASTNode";
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


export abstract class ASTSyncVisitorAdapter implements ASTSyncVisitor {
    /**
     * Default visit on any type of node.
     * It does nothing by default: override to implement.
     */
    protected visitNode(node: ASTNode, depth: number) {};

    visitBlockNode(node: BlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitCommandNode(node: CommandNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitCommentNode(node: CommentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitCurlyBracesParameterBlockNode(node: CurlyBracesParameterBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitDisplayMathNode(node: DisplayMathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitEnvironmentNode(node: EnvironmentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitInlineMathNode(node: InlineMathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitLatexNode(node: LatexNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitMathNode(node: MathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitParameterAssignmentNode(node: ParameterAssignmentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitParameterKeyNode(node: ParameterKeyNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitParameterListNode(node: ParameterListNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitParameterNode(node: ParameterNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitParameterValueNode(node: ParameterValueNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitSpecialSymbolNode(node: SpecialSymbolNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitSquareBracesParameterBlockNode(node: SquareBracesParameterBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitTextNode(node: TextNode, depth: number): void {
        this.visitNode(node, depth);
    }

    visitWhitespaceNode(node: WhitespaceNode, depth: number): void {
        this.visitNode(node, depth);
    }
}


export abstract class ASTAsyncVisitorAdapter implements ASTAsyncVisitor {
    /**
     * Default visit on any type of node.
     * It does nothing by default: override to implement.
     */
    protected async visitNode(node: ASTNode, depth: number) {};

    async visitBlockNode(node: BlockNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitCommandNode(node: CommandNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitCommentNode(node: CommentNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitCurlyBracesParameterBlockNode(node: CurlyBracesParameterBlockNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitDisplayMathNode(node: DisplayMathNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitEnvironmentNode(node: EnvironmentNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitInlineMathNode(node: InlineMathNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitLatexNode(node: LatexNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitMathNode(node: MathNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitParameterAssignmentNode(node: ParameterAssignmentNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitParameterKeyNode(node: ParameterKeyNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitParameterListNode(node: ParameterListNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitParameterNode(node: ParameterNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitParameterValueNode(node: ParameterValueNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitSpecialSymbolNode(node: SpecialSymbolNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitSquareBracesParameterBlockNode(node: SquareBracesParameterBlockNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitTextNode(node: TextNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }

    async visitWhitespaceNode(node: WhitespaceNode, depth: number): Promise<void> {
        await this.visitNode(node, depth);
    }
}
