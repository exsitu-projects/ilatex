import * as P from "parsimmon";
import { ASTNode, ASTNodeType, ASTCommandNode, ASTEnvironementNode, ASTLatexNode } from "./LatexASTNode";
import { language } from "./LatexASTParsers";
import { LatexASTVisitor } from "./LatexASTVisitor";


/** Class of errors thrown when the parsing process fails. */
class LatexParsingError {
    readonly failure: P.Failure;

    constructor(failure: P.Failure) {
        this.failure = failure;
    }
}


/** Type of the root node of an AST. */
export type ASTRoot = ASTLatexNode;


/** Class of an AST for a simple subset of Latex. */
export class LatexAST {
    private rootNode: ASTRoot;
    
    constructor(input: string) {
        this.rootNode = this.parse(input);
    }

    get root() {
        return this.rootNode;
    }

    private parse(input: string): ASTRoot {
        const parserResult = language.latex.parse(input);
        
        if (parserResult.status === true) {
            return parserResult.value;
        }
        else {
            throw new LatexParsingError(parserResult);
        }
    }

    private visitTree(root: ASTNode, depth: number, visitor: LatexASTVisitor): void {
        // Visit the given node
        visitor.visit(root, depth);

        // Visit the subtree(s) rooted in the given node
        const nodeType = root.type;
        if (nodeType === ASTNodeType.Command) {
            const node = root as ASTCommandNode;
            
            for (let parameterNodeArray of node.value.parameters) {
                // Absent optional parameters yield zero-length arrays
                // Therefore, they should be ignored during the tree visit
                if (parameterNodeArray.length === 1) {
                    this.visitTree(parameterNodeArray[0], depth + 1, visitor);
                }
            }    
        }
        else if (nodeType === ASTNodeType.Environement) {
            const node = root as ASTEnvironementNode;
            this.visitTree(node.value.begin, depth + 1, visitor);

            for (let parameterNodeArray of node.value.parameters) {
                // Absent optional parameters yield zero-length arrays
                // Therefore, they should be ignored during the tree visit
                if (parameterNodeArray.length === 1) {
                    this.visitTree(parameterNodeArray[0], depth + 1, visitor);
                }
            }

            this.visitTree(node.value.content, depth + 1, visitor);
            this.visitTree(node.value.end, depth + 1, visitor);
        }
        else if (nodeType === ASTNodeType.Block
             ||  nodeType === ASTNodeType.InlineMathBlock
             ||  nodeType === ASTNodeType.MathBlock
             ||  nodeType === ASTNodeType.CurlyBracesParameterBlock
             ||  nodeType === ASTNodeType.SquareBracesParameterBlock) {
            this.visitTree(root.value as ASTNode, depth + 1, visitor);
        }
        else if (nodeType === ASTNodeType.Latex
             ||  nodeType === ASTNodeType.ParameterAssigments) {
            for (let blockNode of root.value as ASTNode[]) {
                this.visitTree(blockNode, depth + 1, visitor);
            }  
        }
        else /* string values */ {
            // Nothing to do
        }
    }

    visit(visitor: LatexASTVisitor): void {
        this.visitTree(this.root, 0, visitor);
    }
}