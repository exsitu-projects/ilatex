import { ASTNode } from "../LatexASTNode";
import { LatexASTVisitorAdapter } from "./LatexASTVisitorAdapter";

/** Visitor that builds a list of all the visited nodes. */
export class LatexASTNodeCollecter extends LatexASTVisitorAdapter {
    readonly nodes: ASTNode[];

    constructor() {
        super();
        this.nodes = [];
    }

    protected visitNode(node: ASTNode, depth: number) {
        this.nodes.push(node);
    };
};