import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { ASTNode } from "../../ast/nodes/ASTNode";
import { ASTVisitorAdapter } from "../../ast/visitors/ASTVisitorAdapter";
import { SourceFile } from "../../source-files/SourceFile";
import { VisualisationModelProvider } from "../VisualisationModelProvider";

export class ASTNodeCandidatesExtractor extends ASTVisitorAdapter {
    private readonly modelProviders: VisualisationModelProvider[];
    private modelProvidersToCandidateNodes: ArrayMap<VisualisationModelProvider, ASTNode>;

    constructor(modelProviders: VisualisationModelProvider[]) {
        super();

        this.modelProviders = modelProviders;
        this.modelProvidersToCandidateNodes = new ArrayMap();
    }

    runOnSourceFile(sourceFile: SourceFile): ArrayMap<VisualisationModelProvider, ASTNode> {
        this.reset();

        // Since this extractor uses an AST visitor, it requires that the given source file has a valid AST
        // Otherwise, there is nothing to extract
        if (sourceFile.ast.hasRoot) {
            sourceFile.ast.visitWith(this);
        }
        else {
            console.warn(`No AST node candidate can be extracted from the given source file (${sourceFile.name}): the AST has no root.`);
        }

        return this.modelProvidersToCandidateNodes;
    }

    private reset(): void {
        this.modelProvidersToCandidateNodes = new ArrayMap();
    }

    protected visitNode(node: ASTNode) {
        for (let modelProvider of this.modelProviders) {
            if (modelProvider.canProvideForASTNode(node)) {
                this.modelProvidersToCandidateNodes.add(modelProvider, node);
            }
        }
    };
}