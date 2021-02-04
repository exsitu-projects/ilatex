import { range } from "parsimmon";
import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { ASTNode } from "../../ast/nodes/ASTNode";
import { CodeMapping, CodeMappingID } from "../../code-mappings/CodeMapping";
import { InteractiveLatex } from "../../InteractiveLaTeX";
import { SourceFile } from "../../source-files/SourceFile";
import { PositionInFile } from "../../utils/PositionInFile";
import { VisualisationModel } from "../VisualisationModel";
import { VisualisationModelProvider } from "../VisualisationModelProvider";
import { VisualisationModelUtilities } from "../VisualisationModelUtilities";
import { ASTNodeCandidatesExtractor } from "./ASTNodeCandidateExtractor";


export class VisualisationModelExtractor {
    private static readonly MODEL_PROVIDERS: VisualisationModelProvider[] = [
        // TODO: update visualisations to use the new provider interface
        // new MathematicsModelFactory(),
        // new IncludegraphicsModelFactory(),
        // new TabularModelFactory(),
        // new GridLayoutModelFactory(),
    ];

    private ilatex: InteractiveLatex;
    private astNodeCandidatesExtractor: ASTNodeCandidatesExtractor;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        this.astNodeCandidatesExtractor = new ASTNodeCandidatesExtractor(VisualisationModelExtractor.MODEL_PROVIDERS);
    }

    private get modelUtilities(): VisualisationModelUtilities {
        return VisualisationModelUtilities.from(this.ilatex);
    }

    private mapSourceFilesToCodeMappings(): ArrayMap<SourceFile, CodeMapping> {
        const codeMappings = this.ilatex.codeMappingManager.codeMappings;
        const sourceFilesToCodeMappings = new ArrayMap<SourceFile, CodeMapping>();

        for (let codeMapping of codeMappings) {
            const sourceFile = this.ilatex.sourceFileManager.getSourceFileOfCodeMapping(codeMapping);
            if (sourceFile) {
                sourceFilesToCodeMappings.add(sourceFile, codeMapping);
            }
        }

        return sourceFilesToCodeMappings;
    }

    private mapModelProvidersToCodeMappings(codeMappings: CodeMapping[]): ArrayMap<VisualisationModelProvider, CodeMapping> {
        const modelProvidersToCodeMappings = new ArrayMap<VisualisationModelProvider, CodeMapping>();

        for (let codeMapping of codeMappings) {
            for (let modelProvider of VisualisationModelExtractor.MODEL_PROVIDERS) {
                if (modelProvider.canProvideForCodeMapping(codeMapping)) {
                    modelProvidersToCodeMappings.add(modelProvider, codeMapping);
                }
            }
        }

        return modelProvidersToCodeMappings;
    }

    extractModelsForAllSourceFiles(): VisualisationModel[] {
        const extractedModels: VisualisationModel[] = [];
        const addModelWith = (
            provider: VisualisationModelProvider,
            node: ASTNode,
            codeMapping: CodeMapping,
            sourceFile: SourceFile
        ) => {
            extractedModels.push(provider.provideModelWith({
                astNode: node,
                codeMapping: codeMapping,
                sourceFile: sourceFile
            }, this.modelUtilities));
        };

        const sourceFilesToCodeMappings = this.mapSourceFilesToCodeMappings();

        for (let [sourceFile, codeMappings] of sourceFilesToCodeMappings.entries) {
            const modelProvidersToCodeMappings = this.mapModelProvidersToCodeMappings(codeMappings);
            const modelProvidersToCandidateAstNodes = this.astNodeCandidatesExtractor.runOnSourceFile(sourceFile);
            const usefulModelProvidersForCandidateAstNodes = [...modelProvidersToCandidateAstNodes.keys];
            const usefulModelProviders = [...modelProvidersToCodeMappings.keys]
                .filter(modelProvider => usefulModelProvidersForCandidateAstNodes.includes(modelProvider));

            for (let modelProvider of usefulModelProviders) {
                const codeMappings = modelProvidersToCodeMappings.getValuesOf(modelProvider);
                const astNodes = modelProvidersToCandidateAstNodes.getValuesOf(modelProvider);

                const unusedCodeMappings = new Set(codeMappings);
                const unusedAstNodes = new Set(astNodes);

                // 1. Perfect line number matches
                for (let codeMapping of codeMappings) {
                    loopOverNodes: for (let node of astNodes) {
                        // TODO: use something more robust than the initial line
                        if (node.range.from.initialLine === codeMapping.lineNumber - 1) {
                            if (!unusedAstNodes.has(node)) {
                                continue loopOverNodes;
                            }

                            addModelWith(modelProvider, node, codeMapping, sourceFile);
                            unusedCodeMappings.delete(codeMapping);
                            unusedAstNodes.delete(node);

                            break loopOverNodes;
                        }
                    }
                }

                // 2. Heurtistic for remaining code mappings/AST nodes
                if (unusedCodeMappings.size > 0 && unusedAstNodes.size > 0) {
                    const remainingCodeMappingsSortedByLineNumber = [...unusedCodeMappings]
                        .sort((cm1, cm2) => cm1.lineNumber - cm2.lineNumber);
                    const remainingAstNodesSortedByStartPosition = [...unusedAstNodes]
                        .sort((node1, node2) => PositionInFile.compareInAscendingOrder(node1.range.from, node2.range.from));
                    const nbApproximateMappingsToMake = Math.min(
                        remainingCodeMappingsSortedByLineNumber.length,
                        remainingAstNodesSortedByStartPosition.length
                    );

                    for (let i = 0; i < nbApproximateMappingsToMake; i++) {
                        const codeMapping = remainingCodeMappingsSortedByLineNumber[i];
                        const node = remainingAstNodesSortedByStartPosition[i];

                        addModelWith(modelProvider, node, codeMapping, sourceFile);
                        unusedCodeMappings.delete(codeMapping);
                        unusedAstNodes.delete(node);
                    }

                    if (unusedCodeMappings.size > 0) {
                        console.warn("Some visualisations may be missing: there was no more AST node to approximately pair the following code mappings with:", unusedCodeMappings);
                    }

                    if (unusedAstNodes.size > 0) {
                        console.warn("Some visualisations may be missing: there was no more code mappings to approximately pair the following AST nodes with:", unusedAstNodes);
                    }
                }
            }
        }

        return extractedModels;
    }
}