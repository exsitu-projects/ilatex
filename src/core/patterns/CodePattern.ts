import { ASTNode } from "../ast/LatexASTNode";

export interface CodePattern<T extends ASTNode = ASTNode> {
    match: (node: ASTNode) => boolean;
    onMatch: (node: T) => void;
}