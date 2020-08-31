import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";
import { ASTNode, ASTEnvironementNode, ASTCommandNode } from "../ast/LatexASTNode";
import { CodePattern } from "./CodePattern";
import { LatexASTVisitor } from "../ast/visitors/LatexASTVisitor";

export class CodePatternDetector implements LatexASTVisitor {
    readonly patterns: CodePattern[];

    constructor() {
        this.patterns = [];
    }

    visit(node: ASTNode): void {
        for (let pattern of this.patterns) {
            if (pattern.matches(node)) {
                pattern.onMatch(node);
            }
        }
    }
}