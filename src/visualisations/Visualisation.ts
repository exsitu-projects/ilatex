import { ASTNode } from "../ast/LatexASTNode";

export abstract class Visualisation {
    protected node: ASTNode;

    constructor(node: ASTNode) {
        this.node = node;
    }
}