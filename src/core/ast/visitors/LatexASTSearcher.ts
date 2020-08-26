import { LatexASTVisitorAdapter } from "./LatexASTVisitorAdapter";
import { ASTNode } from "../LatexASTNode";
 
type MatchTester = (node: ASTNode) => boolean;

export class LatexASTSearcher extends LatexASTVisitorAdapter {
    protected test: MatchTester;
    protected maxNbMatches: number;
    protected matchingNodes: ASTNode[];

    constructor(test: MatchTester, maxNbMatches: number = Number.MAX_SAFE_INTEGER) {
        super();

        this.test = test;
        this.maxNbMatches = maxNbMatches;
        this.matchingNodes = [];
    }

    get match(): ASTNode | null {
        if (this.matchingNodes.length === 0) {
            return null;
        }

        return this.matchingNodes[0];
    }

    get matches(): ASTNode[] {
        return this.matchingNodes;
    }

    get nbMatches(): number {
        return this.matchingNodes.length;
    }

    reset(): void {
        this.matchingNodes = [];
    }

    protected visitNode(node: ASTNode): void {
        if (this.matchingNodes.length < this.maxNbMatches
        &&  this.test(node)) {
            this.matchingNodes.push(node);
        }
    }
}