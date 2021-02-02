import { ASTVisitor } from "./ASTVisitor";
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


export abstract class ASTVisitorAdapter implements ASTVisitor {
    /**
     * Default visit on any type of node.
     * It does nothing by default: override to implement.
     */
    protected visitNode(node: ASTNode, depth: number) {};

    protected visitBlockNode(node: BlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitCommandNode(node: CommandNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitCommentNode(node: CommentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitCurlyBracesParameterBlockNode(node: CurlyBracesParameterBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitDisplayMathNode(node: DisplayMathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitEnvironmentNode(node: EnvironmentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitInlineMathNode(node: InlineMathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitLatexNode(node: LatexNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitMathNode(node: MathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterAssignmentNode(node: ParameterAssignmentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterKeyNode(node: ParameterKeyNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterListNode(node: ParameterListNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterNode(node: ParameterNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterValueNode(node: ParameterValueNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitSpecialSymbolNode(node: SpecialSymbolNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitSquareBracesParameterBlockNode(node: SquareBracesParameterBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitTextNode(node: TextNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitWhitespaceNode(node: WhitespaceNode, depth: number): void {
        this.visitNode(node, depth);
    }
    
    visit(node: ASTNode, depth: number): void {
        if (node instanceof BlockNode) {
            this.visitBlockNode(node, depth);
        }
        else if (node instanceof CommandNode) {
            this.visitCommandNode(node, depth);
        }
        else if (node instanceof CommentNode) {
            this.visitCommentNode(node, depth);
        }
        else if (node instanceof CurlyBracesParameterBlockNode) {
            this.visitCurlyBracesParameterBlockNode(node, depth);
        }
        else if (node instanceof DisplayMathNode) {
            this.visitDisplayMathNode(node, depth);
        }
        else if (node instanceof EnvironmentNode) {
            this.visitEnvironmentNode(node, depth);
        }
        else if (node instanceof InlineMathNode) {
            this.visitInlineMathNode(node, depth);
        }
        else if (node instanceof LatexNode) {
            this.visitLatexNode(node, depth);
        }
        else if (node instanceof MathNode) {
            this.visitMathNode(node, depth);
        }
        else if (node instanceof ParameterAssignmentNode) {
            this.visitParameterAssignmentNode(node, depth);
        }
        else if (node instanceof ParameterKeyNode) {
            this.visitParameterKeyNode(node, depth);
        }
        else if (node instanceof ParameterListNode) {
            this.visitParameterListNode(node, depth);
        }
        else if (node instanceof ParameterNode) {
            this.visitParameterNode(node, depth);
        }
        else if (node instanceof ParameterValueNode) {
            this.visitParameterValueNode(node, depth);
        }
        else if (node instanceof SpecialSymbolNode) {
            this.visitSpecialSymbolNode(node, depth);
        }
        else if (node instanceof SquareBracesParameterBlockNode) {
            this.visitSquareBracesParameterBlockNode(node, depth);
        }
        else if (node instanceof TextNode) {
            this.visitTextNode(node, depth);
        }
        else if (node instanceof WhitespaceNode) {
            this.visitWhitespaceNode(node, depth);
        }
    }
}
