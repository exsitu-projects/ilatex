import { ASTNode } from "../ast/LatexASTNode";

export interface CodePattern {
    matches(node: ASTNode): boolean;
    onMatch(node: ASTNode): void;
}