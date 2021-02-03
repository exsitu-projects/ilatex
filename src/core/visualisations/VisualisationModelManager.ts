import * as vscode from "vscode";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { VisualisableNodeExtractor } from "./VisualisableNodeExtractor";
import { VisualisationModelFactory, VisualisationModel, ModelUID, VisualisationModelUtilities } from "./VisualisationModel";
import { ASTNode } from "../ast/LatexASTNode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { IncludegraphicsModelFactory } from "../../visualisations/includegraphics/model/model";
import { TabularModelFactory } from "../../visualisations/tabular/model/model";
import { GridLayoutModelFactory } from "../../visualisations/gridlayout/model/model";
import { SourceFile } from "../mappings/SourceFile";
import { CodeMapping, CodeMappingID } from "../mappings/CodeMapping";
import { MathematicsModelFactory } from "../../visualisations/mathematics/model/model";

export class VisualisationModelManager {
    private static readonly AVAILABLE_VISUALISATION_FACTORIES: VisualisationModelFactory[] = [
        new MathematicsModelFactory(),
        new IncludegraphicsModelFactory(),
        new TabularModelFactory(),
        new GridLayoutModelFactory(),
    ];

    private ilatex: InteractiveLatex;

    private nodeExtractor: VisualisableNodeExtractor;
    private visualisationModels: VisualisationModel[];
    private visualisationModelChangeObserverDispoables: vscode.Disposable[];

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        
        this.nodeExtractor = new VisualisableNodeExtractor();
        this.visualisationModels = [];
        this.visualisationModelChangeObserverDispoables = [];

        this.initNodeExtractor();
    }

    get visualisationViewsContent(): string {
        return this.visualisationModels
            .map(visualisation => visualisation.createViewContent())
            .join("\n");
    }

    get models(): VisualisationModel[] {
        return [...this.visualisationModels];
    }

    private get modelUtilities(): VisualisationModelUtilities {
        return {
            mainSourceFileUri: this.ilatex.mainSourceFileUri,

            createWebviewSafeUri: this.ilatex.webviewManager.adaptURI
                .bind(this.ilatex.webviewManager),

            // TODO: only parse and extract new vis. models from the given source file?
            requestNewParsingOf: async (sourceFile: SourceFile) => {
                await this.ilatex.codeMappingManager.updateCodeMappingsFromLatexGeneratedFile();
                this.extractNewModelsAndUpdateWebview(true);
            }
        };
    }

    dispose(): void {
        this.stopObservingCurrentModelChanges();
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

    private startObservingCurrentModelChanges(): void {
        for (let model of this.visualisationModels) {
            const observable = model.onModelChangeEventEmitter.event(model => {
                this.updateOneWebviewVisualisation(model);
            });

            this.visualisationModelChangeObserverDispoables.push(observable);
        }
    }

    private stopObservingCurrentModelChanges(): void {
        for (let disposable of this.visualisationModelChangeObserverDispoables) {
            disposable.dispose();
        }

        this.visualisationModelChangeObserverDispoables = [];
    }

    async dispatchNotification(message: NotifyVisualisationModelMessage): Promise<void> {
        const model = this.getModelWithUid(message.visualisationUid);
        if (!model) {
            console.error(`The notification cannot be dispatched: there is no model with UID "${message.visualisationUid}".`);
            return;
        }

        return model.handleViewNotification(message);
    }

    private extractModelsFrom(sourceFile: SourceFile): void {
        const absolutePath = sourceFile.absolutePath;
        const nodesPerVisualisationName = this.nodeExtractor.extractMatchingNodesFrom(sourceFile.ast);
        const mappings = this.ilatex.codeMappingManager.getMappingsWith(absolutePath);

        const alreadyVisualisedMappings = new Set<CodeMapping>();

        for (let visualisationName of nodesPerVisualisationName.keys) {
            const modelFactory = VisualisationModelManager.AVAILABLE_VISUALISATION_FACTORIES
                .find(factory => factory.visualisationName === visualisationName)!;

            const remainingMappingsForCurrentFactory = new Set(
                mappings.filter(mapping => mapping.type === visualisationName)
            );

            const astNodes = nodesPerVisualisationName.getValuesOf(visualisationName);
            const astNodesWithNoMapping = new Set(astNodes);

            // 1. Create models from AST nodes whose line number is exactly the same
            // than the line number of one of the mappings
            for (let node of astNodes) {
                const lineNumber = node.range.from.line;

                // Get all the mappings of the same type and at the same line than the current match
                const mappingsAtCurrentNodeLine = [...remainingMappingsForCurrentFactory.values()]
                    .filter(mapping => mapping.lineNumber === lineNumber);

                if (mappingsAtCurrentNodeLine.length === 0) {
                    console.warn(`There is no mapping for the code pattern at ${absolutePath}:${lineNumber}`);
                    continue;
                }

                // Since there may be several matches of the same type at the same location (file + line),
                // the mapping to use is the first one that has not been turned into a code visualisation yet
                // To that end, a set of all "used" mappingsAtCurrentNodeLine is kept up-to-date
                const mapping = mappingsAtCurrentNodeLine.find(mapping =>
                    !alreadyVisualisedMappings.has(mapping)
                );

                // Ensure a mapping was found—though this should NOT happen!
                // If it does, it means the pattern detector found more pieces of code to visualise
                // than the LaTex engine at a given line, in a given file
                // Note: it may happen if ilatex.sty fails at identifying the correct start position
                // of a commands/environements/etc located at the same line than other viualisations
                if (!mapping) {
                    console.warn(`All the mappings at ${absolutePath}:${lineNumber} have already been used; the remaining visualisable AST nodes will therefore be ignored!`);
                    continue;
                }
                
                // If a mapping was found, mark the mapping + the node as "used"
                // and use them to create a new visualisation model
                alreadyVisualisedMappings.add(mapping);
                remainingMappingsForCurrentFactory.delete(mapping);
                astNodesWithNoMapping.delete(node);

                this.visualisationModels.push(
                    modelFactory.createModel(node, mapping, this.modelUtilities)
                );
            }

            // 2. If some mappings and some nodes have still not been used,
            // we assume this is because the line number generated by LaTeX is wrong
            // (e.g. if a command/environement/etc to visualise is used in a macro
            //  and expanded when the macro itself is expanded, the line number
            //  will probably be the line at which the macro is expanded).
            // In an attempt to fix this type of issue, we accept "approximate"
            // line number matchings: models are created from remaining mappings and nodes
            // in the order in which they start (in the AST and in the LaTeX generated file).
            const remaingMappingsSortedByLineNumber = [...remainingMappingsForCurrentFactory.values()]
                .sort((mapping1, mapping2) => mapping1.lineNumber - mapping2.lineNumber);
            const remaingNodesSortedByStartPosition = [...astNodesWithNoMapping.values()]
                .sort((node1, node2) => node1.range.from.offset - node2.range.from.offset);
            
            for (let mapping of remaingMappingsSortedByLineNumber) {
                const node = remaingNodesSortedByStartPosition.shift();
                if (!node) {
                    console.warn(`All the visualisable AST nodes for mappings of type '${visualisationName}' have been used, but not all mappings have; the remaining mappings will therefore be ignored!`);
                    break;
                }

                this.visualisationModels.push(
                    modelFactory.createModel(node, mapping, this.modelUtilities)
                );
            }

            if (remaingNodesSortedByStartPosition.length > 0) {
                console.warn(`All the mappings of type '${visualisationName}' have been used, but not all visualisable AST nodes have; the remaining nodes will therefore be ignored!`);
            }
        }
    }

    extractNewModels(): void {
        this.stopObservingCurrentModelChanges();
        this.visualisationModels = [];

        const sourceFiles = this.ilatex.codeMappingManager.allSourceFiles;
        for (let sourceFile of sourceFiles) {
            this.extractModelsFrom(sourceFile);
        }

        this.startObservingCurrentModelChanges();

        console.info(`${this.visualisationModels.length} visualisations model(s) have been created from the mappings:`);
        console.log(
            this.visualisationModels
                .map(model => `\t${model.codeMappingId} — ${model.visualisationName}`)
                .join("\n")
        );
    }

    private updateOneWebviewVisualisation(model: VisualisationModel): void {
        this.ilatex.webviewManager.sendNewContentForOneVisualisation(
            model.uid,
            model.createViewContent()
        );
    }

    updateAllWebviewVisualisations(updateOpenVisualisation: boolean = false): void {
        this.ilatex.webviewManager.sendNewContentForAllVisualisations(
            this.visualisationViewsContent,
            updateOpenVisualisation
        );
    }

    extractNewModelsAndUpdateWebview(updateOpenVisualisation: boolean = false): void {
        this.extractNewModels();
        this.updateAllWebviewVisualisations(updateOpenVisualisation);
    }
}