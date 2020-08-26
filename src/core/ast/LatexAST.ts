import * as P from "parsimmon";
import { ASTNode, ASTNodeType, ASTCommandNode, ASTEnvironementNode, ASTLatexNode } from "./LatexASTNode";
import { language } from "./LatexASTParsers";
import { LatexASTVisitor } from "./visitors/LatexASTVisitor";


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

    visitWith(visitor: LatexASTVisitor, maxDepth: number = Number.MAX_SAFE_INTEGER): void {
        this.root.visitWith(visitor, 0, maxDepth);
    }
}