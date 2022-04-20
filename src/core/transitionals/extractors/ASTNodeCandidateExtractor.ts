import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { ASTNode } from "../../ast/nodes/ASTNode";
import { ASTSyncVisitorAdapter } from "../../ast/visitors/adapters";
import { SourceFile } from "../../source-files/SourceFile";
import { TransitionalModelProvider } from "../TransitionalModelProvider";

export class ASTNodeCandidatesExtractor extends ASTSyncVisitorAdapter {
    private readonly modelProviders: TransitionalModelProvider[];
    private modelProvidersToCandidateNodes: ArrayMap<TransitionalModelProvider, ASTNode>;

    constructor(modelProviders: TransitionalModelProvider[]) {
        super();

        this.modelProviders = modelProviders;
        this.modelProvidersToCandidateNodes = new ArrayMap();
    }

    runOnSourceFile(sourceFile: SourceFile): ArrayMap<TransitionalModelProvider, ASTNode> {
        this.reset();

        // Since this extractor uses an AST visitor, it requires that the given source file has a valid AST
        // Otherwise, there is nothing to extract
        if (sourceFile.ast.hasRoot) {
            sourceFile.ast.syncVisitWith(this);
        }
        else {
            console.warn(`No AST node candidate can be extracted from the given source file (${sourceFile.name}): the AST has no root.`);
        }

        return this.modelProvidersToCandidateNodes;
    }

    private reset(): void {
        this.modelProvidersToCandidateNodes = new ArrayMap();
    }

    protected async visitNode(node: ASTNode): Promise<void> {
        for (let modelProvider of this.modelProviders) {
            if (modelProvider.canProvideForASTNode(node)) {
                this.modelProvidersToCandidateNodes.add(modelProvider, node);
            }
        }
    };
}