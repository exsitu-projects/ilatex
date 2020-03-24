import { LatexASTVisitor } from "./LatexASTVisitor";
import { ASTLatexNode, ASTTextNode, ASTEnvironementNode, ASTCommandNode, ASTInlineMathBlockNode, ASTMathBlockNode, ASTBlockNode, ASTParameterNode, ASTParameterKeyNode, ASTParameterValueNode, ASTParameterAssigmentNode, ASTSpecialSymbolNode, ASTCommentNode, ASTNode, ASTNodeType, ASTCurlyBracesParameterBlock, ASTSquareBracesParameterBlock, ASTParameterAssigmentsNode, ASTMathNode } from "./LatexASTNode";

export abstract class LatexASTVisitorAdapter implements LatexASTVisitor {
    constructor() {}

    /** Default visit on any type of node. */
    protected abstract visitNode(node: ASTNode, depth: number): void;

    protected visitLatexNode(node: ASTLatexNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitTextNode(node: ASTTextNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitEnvironementNode(node: ASTEnvironementNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitCommandNode(node: ASTCommandNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitMathNode(node: ASTMathNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitInlineMathBlockNode(node: ASTInlineMathBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitMathBlockNode(node: ASTMathBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitBlockNode(node: ASTBlockNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitCurlyBracesParameterBlockNode(node: ASTCurlyBracesParameterBlock, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterNode(node: ASTParameterNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitSquareBracesParameterBlockNode(node: ASTSquareBracesParameterBlock, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterKeyNode(node: ASTParameterKeyNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterValueNode(node: ASTParameterValueNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterAssigmentNode(node: ASTParameterAssigmentNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitParameterAssigmentsNode(node: ASTParameterAssigmentsNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitSpecialSymbolNode(node: ASTSpecialSymbolNode, depth: number): void {
        this.visitNode(node, depth);
    }

    protected visitCommentNode(node: ASTCommentNode, depth: number): void {
        this.visitNode(node, depth);
    }
    
    visit(node: ASTNode, depth: number): void {
        switch(node.type) {
            case ASTNodeType.Latex:
                this.visitLatexNode(node as ASTLatexNode, depth);
                break;

            case ASTNodeType.Text:
                this.visitTextNode(node as ASTTextNode, depth);
                break;
            
            case ASTNodeType.Environement:
                this.visitEnvironementNode(node as ASTEnvironementNode, depth);
                break;
    
            case ASTNodeType.Command:
                this.visitCommandNode(node as ASTCommandNode, depth);
                break;

            case ASTNodeType.Math:
                this.visitCommandNode(node as ASTCommandNode, depth);
                break;

            case ASTNodeType.InlineMathBlock:
                this.visitInlineMathBlockNode(node as ASTInlineMathBlockNode, depth);
                break;

            case ASTNodeType.MathBlock:
                this.visitMathBlockNode(node as ASTMathBlockNode, depth);
                break;
            
            case ASTNodeType.Block:
                this.visitBlockNode(node as ASTBlockNode, depth);
                break;
    
            case ASTNodeType.CurlyBracesParameterBlock:
                this.visitCurlyBracesParameterBlockNode(node as ASTCurlyBracesParameterBlock, depth);
                break;

            case ASTNodeType.SquareBracesParameterBlock:
                this.visitSquareBracesParameterBlockNode(node as ASTSquareBracesParameterBlock, depth);
                break;

            case ASTNodeType.Parameter:
                this.visitParameterNode(node as ASTParameterNode, depth);
                break;
            
            case ASTNodeType.ParameterKey:
                this.visitParameterKeyNode(node as ASTParameterKeyNode, depth);
                break;

            case ASTNodeType.ParameterValue:
                this.visitParameterValueNode(node as ASTParameterValueNode, depth);
                break;

            case ASTNodeType.ParameterAssigment:
                this.visitParameterAssigmentNode(node as ASTParameterAssigmentNode, depth);
                break;

            case ASTNodeType.ParameterAssigments:
                this.visitParameterAssigmentsNode(node as ASTParameterAssigmentsNode, depth);
                break;

            case ASTNodeType.SpecialSymbol:
                this.visitSpecialSymbolNode(node as ASTSpecialSymbolNode, depth);
                break;

            case ASTNodeType.Comment:
                this.visitCommentNode(node as ASTCommentNode, depth);
                break;
        }
    }
}
