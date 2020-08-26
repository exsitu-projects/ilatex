import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";
import { ASTNode, ASTEnvironementNode, ASTCommandNode } from "../ast/LatexASTNode";
import { CodePattern } from "./CodePattern";

export class CodePatternDetector extends LatexASTVisitorAdapter {
    readonly commandPatterns: CodePattern<ASTCommandNode>[];
    readonly environementsPatterns: CodePattern<ASTEnvironementNode>[];

    constructor() {
        super();

        this.commandPatterns = [];
        this.environementsPatterns = [];
    }

    protected visitCommandNode(node: ASTCommandNode): void {
        for (let pattern of this.commandPatterns) {
            CodePatternDetector.attemptMatch(pattern, node);
        }
    }

    protected visitEnvironementNode(node: ASTEnvironementNode): void {
        for (let pattern of this.environementsPatterns) {
            CodePatternDetector.attemptMatch(pattern, node);
        }
    }

    private static attemptMatch<T extends ASTNode>(pattern: CodePattern<T>, node: ASTNode) {
        if (pattern.match(node)) {
            pattern.onMatch(node as T);
        }
    }
}