import { ASTNode } from "./LatexASTNode";

export interface LatexASTVisitor {
    visit(node: ASTNode, depth: number): void;
}