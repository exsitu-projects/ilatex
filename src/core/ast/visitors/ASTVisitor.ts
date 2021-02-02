import { ASTNode } from "../nodes/ASTNode";

export interface ASTVisitor {
    visit(node: ASTNode, depth: number): void;
}