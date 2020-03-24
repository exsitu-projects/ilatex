import { LatexASTVisitorAdapter } from "../ast/LatexASTVisitorAdapter";
import { ASTNode, ASTEnvironementNode, ASTCommandNode } from "../ast/LatexASTNode";
import { CodePattern } from "./CodePattern";

export class CodePatternDetector extends LatexASTVisitorAdapter {
    readonly commandPatterns: CodePattern[];
    readonly environementsPatterns: CodePattern[];

    constructor() {
        super();

        this.commandPatterns = [];
        this.environementsPatterns = [];
    }

    // Unused
    protected visitNode(node: ASTNode, depth: number): void {}

    protected visitCommandNode(node: ASTCommandNode, depth: number): void {
        for (let pattern of this.commandPatterns) {
            CodePatternDetector.attemptMatch(pattern, node);
        }
    }

    protected visitEnvironementNode(node: ASTEnvironementNode, depth: number): void {
        for (let pattern of this.environementsPatterns) {
            CodePatternDetector.attemptMatch(pattern, node);
        }
    }

    private static attemptMatch(pattern: CodePattern, node: ASTNode) {
        if (pattern.match(node)) {
            pattern.onMatch(node);
        }
    }
}