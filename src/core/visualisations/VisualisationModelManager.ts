import { InteractiveLatex } from "../InteractiveLaTeX";
import { VisualisableNodeExtractor } from "./VisualisableNodeExtractor";
import { VisualisationModelFactory, VisualisationModel, ModelUID, VisualisationModelUtilities } from "./VisualisationModel";
import { ASTNode } from "../ast/LatexASTNode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { IncludegraphicsModelFactory } from "../../visualisations/includegraphics/model/model";
import { TabularModelFactory } from "../../visualisations/tabular/model/model";
import { GridLayoutModelFactory } from "../../visualisations/gridlayout/model/model";
import { SourceFile } from "../mappings/SourceFile";
import { CodeMappingID } from "../mappings/CodeMapping";

export class VisualisationModelManager {
    private static readonly AVAILABLE_VISUALISATION_FACTORIES: VisualisationModelFactory[] = [
        new IncludegraphicsModelFactory(),
        new TabularModelFactory(),
        new GridLayoutModelFactory()
    ];

    private ilatex: InteractiveLatex;

    private nodeExtractor: VisualisableNodeExtractor;
    private visualisationModels: VisualisationModel[];


    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        
        this.nodeExtractor = new VisualisableNodeExtractor();
        this.visualisationModels = [];

        this.initNodeExtractor();
    }

    get visualisationViewsContent(): string {
        return this.visualisationModels
            .map(visualisation => visualisation.createViewContent())
            .join("\n");
    }

    private get modelUtilities(): VisualisationModelUtilities {
        return {
            mainSourceFileUri: this.ilatex.mainSourceFileUri,

            createWebviewSafeUri: this.ilatex.webviewManager.adaptURI
                .bind(this.ilatex.webviewManager),

            // TODO: only parse and extract new vis. models from the given source file?
            requestNewParsingOf: async (sourceFile: SourceFile) => {
                await this.ilatex.codeMappingManager.updateMappingsFromLatexGeneratedFile();
                this.extractNewModelsAndUpdateWebview(true);
            }
        };
    }

    dispose(): void {

    }

    private initNodeExtractor(): void {
        this.nodeExtractor.matchingRules =
            VisualisationModelManager.AVAILABLE_VISUALISATION_FACTORIES
                .map(factory => {
                    return {
                        name: factory.visualisationName,
                        matches: factory.astMatchingRule
                    };
                });
    }

    private getModelWithUid(uid: ModelUID): VisualisationModel | null {
        const result = this.visualisationModels
            .find(model => model.uid === uid);

        return result ?? null;
    }

    private getModelWithCodeMappingId(id: CodeMappingID): VisualisationModel | null {
        const result = this.visualisationModels
            .find(model => model.codeMappingId === id);

        return result ?? null;
    }

    async dispatchNotification(message: NotifyVisualisationModelMessage): Promise<void> {
        const model = this.getModelWithUid(message.visualisationUid);
        if (!model) {
            console.error(`The notification cannot be dispatched: there is no model with UID "${message.visualisationUid}".`);
            return;
        }

        return model.handleViewNotification(message);
    }

    private extractModelsFrom(sourceFile: SourceFile) {
        const nodesPerVisualisationName = this.nodeExtractor.extractMatchingNodesFrom(sourceFile.ast);
        const alreadyVisualisedMappings = new Set();

        for (let visualisationName of nodesPerVisualisationName.keys) {
            const modelFactory = VisualisationModelManager.AVAILABLE_VISUALISATION_FACTORIES
                .find(factory => factory.visualisationName === visualisationName)!;

            for (let node of nodesPerVisualisationName.getValuesOf(visualisationName)) {
                const absolutePath = sourceFile.absolutePath;
                const lineNumber = node.start.line;

                // Get all the mappings of the same type than the type,
                // in the same file and at the same line than the current match
                const mappings = this.ilatex.codeMappingManager
                    .getMappingsWith(
                        visualisationName,
                        absolutePath,
                        lineNumber
                    );

                if (mappings.length === 0) {
                    console.error(`There is no mapping for the code pattern at ${absolutePath}:${lineNumber}`);
                    return;
                }

                // Since there may be several matches of the same type at the same location (file + line),
                // the mapping to use is the first one that has not been turned into a code visualisation yet
                // To that end, a set of all "used" mappings is kept up-to-date
                let mappingToVisualise = mappings.find(mapping =>
                    !alreadyVisualisedMappings.has(mapping)
                );

                // Ensure a mapping was found—though this should NOT happen!
                // If it does, it means the pattern detector found more pieces of code to visualise
                // than the LaTex engine at a given line, in a given file
                // Note: it may happen if ilatex.sty fails at identifying the correct start position
                // of certain commands/environements/etc
                if (!mappingToVisualise) {
                    console.warn(`All the mappings at ${absolutePath}:${lineNumber} have already been visualised; the AST subtree identified by the code matcher will therefore be ignored!`);
                    return;
                }
                
                // If a mapping was found, save it in the set of already used mappings
                // and use it to create a new visualisation model
                alreadyVisualisedMappings.add(mappingToVisualise);
                this.visualisationModels.push(
                    modelFactory.createModel(
                        node,
                        mappingToVisualise,
                        this.modelUtilities)
                );
            }
        }
    }

    extractNewModels(): void {
        this.visualisationModels = [];

        const sourceFiles = this.ilatex.codeMappingManager.allSourceFiles;
        for (let sourceFile of sourceFiles) {
            this.extractModelsFrom(sourceFile);
        }
    }

    updateWebviewVisualisations(requestedByVisualisation: boolean = false): void {
        this.ilatex.webviewManager.sendNewVisualisationViewContent(
            this.visualisationViewsContent,
            requestedByVisualisation
        );
    }

    extractNewModelsAndUpdateWebview(requestedByVisualisation: boolean = false): void {
        this.extractNewModels();
        this.updateWebviewVisualisations(requestedByVisualisation);
    }
}