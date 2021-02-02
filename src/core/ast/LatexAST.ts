import * as P from "parsimmon";
import { SourceFileChange } from "../mappings/SourceFileChange";
import { ASTNode } from "./nodes/ASTNode";
import { LatexNode } from "./nodes/LatexNode";
import { latexParsers } from "./parsers";
import { ASTNodeCollecter } from "./visitors/ASTNodeCollecter";
import { ASTVisitor } from "./visitors/ASTVisitor";

/** Class of errors thrown when the parsing process fails. */
class LatexParsingError {
    readonly failure: P.Failure;

    constructor(failure: P.Failure) {
        this.failure = failure;
    }
}


/** Type of the root node of an AST. */
export type ASTRootNode = LatexNode;


/** Class of an AST for a simple subset of Latex. */
export class LatexAST {
    private rootNode: ASTRootNode;
    private allNodesCached: ASTNode[] | null;
    
    constructor(input: string) {
        this.rootNode = this.parse(input);
        this.allNodesCached = null;
    }

    get root() {
        return this.rootNode;
    }

    get nodes(): ASTNode[] {
        // Either use the cached list of all nodes if it has already been computed,
        // or compute the list and cache it first
        if (!this.allNodesCached) {
            const nodeCollecter = new ASTNodeCollecter();
            this.rootNode.visitWith(nodeCollecter);
            this.allNodesCached = nodeCollecter.nodes;
        }

        return this.allNodesCached;
    }

    processSourceFileEdit(change: SourceFileChange): void {
        for (let node of this.nodes) {
            node.processSourceFileEdit(change);
        }
    }

    private parse(input: string): ASTRootNode {
        const parserResult = latexParsers.latex(input);
        
        if (parserResult.status === true) {
            return parserResult.value;
        }
        else {
            throw new LatexParsingError(parserResult);
        }
    }

    visitWith(visitor: ASTVisitor, maxDepth: number = Number.MAX_SAFE_INTEGER): void {
        this.root.visitWith(visitor, 0, maxDepth);
    }
}