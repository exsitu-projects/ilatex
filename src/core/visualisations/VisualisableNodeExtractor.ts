import { ArrayMap } from "../../shared/utils/ArrayMap";
import { ASTNode } from "../ast/LatexASTNode";
import { LatexASTVisitor } from "../ast/visitors/LatexASTVisitor";
import { LatexAST } from "../ast/LatexAST";


// Type of the matching rules expected by the vis. node extractor 
export interface MatchingRule {
    readonly name: string;
    matches(node: ASTNode): boolean;
}

// Map from each matching rule name to AST nodes 
// matching the pattern specified by the related rule
export type NodeExtractionResult = ArrayMap<string, ASTNode>;

export class VisualisableNodeExtractor {
    matchingRules: MatchingRule[];
    private extractedNodesPerType: NodeExtractionResult;

    constructor() {
        this.matchingRules = [];
        this.extractedNodesPerType = new ArrayMap();
    }

    private get astVisitor(): LatexASTVisitor {
        const self = this;
        return {
            visit(node: ASTNode): void {
                for (let rule of self.matchingRules) {
                    if (rule.matches(node)) {
                        self.onRuleMatch(node, rule);
                    }
                }
            }
        };
    }

    private onRuleMatch(matchingNode: ASTNode, rule: MatchingRule): void {
        this.extractedNodesPerType.add(rule.name, matchingNode);
    }

    extractMatchingNodesFrom(ast: LatexAST): NodeExtractionResult {
        this.extractedNodesPerType.clear();

        ast.visitWith(this.astVisitor);
        return this.extractedNodesPerType.clone();
    }
}