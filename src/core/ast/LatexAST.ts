import * as P from "parsimmon";
import { SourceFileChange } from "../mappings/SourceFileChange";
import { ASTNode, ASTNodeType, ASTCommandNode, ASTEnvironementNode, ASTLatexNode } from "./LatexASTNode";
import { language } from "./LatexASTParsers";
import { LatexASTNodeCollecter } from "./visitors/LatexASTNodeCollecter";
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
            const nodeCollecter = new LatexASTNodeCollecter();
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