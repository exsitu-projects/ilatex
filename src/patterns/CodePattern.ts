import { ASTNode } from "../ast/LatexASTNode";

export interface CodePattern {
    match: (node: ASTNode) => boolean;
    onMatch: (node: ASTNode) => void;
}