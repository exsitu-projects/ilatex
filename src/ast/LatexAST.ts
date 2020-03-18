import * as P from "parsimmon";
import { ASTNode } from "./LatexASTNode";
import { latex } from "./LatexASTParsers";


/** Class of errors thrown when the parsing process fails. */
class LatexParsingError {
    readonly failure: P.Failure;

    constructor(failure: P.Failure) {
        this.failure = failure;
    }
}


/** Type of the root node of an AST. */
export type ASTRoot = ASTNode<any>;


/** Class of an AST for a simple subset of Latex. */
export class LatexAST {
    private rootNode: ASTRoot | null;
    
    constructor(input: string) {
        this.rootNode = null;
        this.parse(input);
    }

    private parse(input: string): void {
        const parserResult = latex.parse(input);
        
        if (parserResult.status === true) {
            this.rootNode = parserResult.value;
        }
        else {
            throw new LatexParsingError(parserResult);
        }
    }

    get root() {
        return this.rootNode;
    }
}