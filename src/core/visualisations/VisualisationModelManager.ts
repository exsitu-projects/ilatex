import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { VisualisationModelFactory, VisualisationModel, ModelUID } from "./VisualisationModel";
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

    private patternDetector: CodePatternDetector;
    private currentVisitedSourceFile: SourceFile | null;
    private visualisationModels: VisualisationModel[];


    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        
        this.patternDetector = new CodePatternDetector();
        this.currentVisitedSourceFile = null;
        this.visualisationModels = [];

        this.initPatternDetector();
    }

    get visualisationViewsContent(): string {
        return this.visualisationModels
            .map(visualisation => visualisation.createViewContent())
            .join("\n");
    }

    dispose(): void {

    }

    private initPatternDetector(): void {
        const utilities = {
            mainSourceFileUri: this.ilatex.mainSourceFileUri,

            createWebviewSafeUri: this.ilatex.webviewManager.adaptURI
                .bind(this.ilatex.webviewManager),

            requestNewParsingOf: async (sourceFile: SourceFile) => {
                // TODO: only parse and extract new vis. models from the given source file?
                await this.ilatex.codeMappingManager.updateMappingsFromLatexGeneratedFile();
                this.extractNewModelsAndUpdateWebview(true);
            }
        };

        // const absolutePathAndLineNumberToCount: Map<string,number> = new Map();
        function combinePathAndLineNumber(path: string, lineNumber: number): string {
            return `${path}:${lineNumber}`;
        }
        
        this.patternDetector.patterns.push(
            ...VisualisationModelManager.AVAILABLE_VISUALISATION_FACTORIES
                .map(factory => {
                    return {
                        matches: factory.codePatternMatcher,
                        onMatch: (node: ASTNode) => {
                            const mappings = this.ilatex.codeMappingManager
                                .getMappingsWith(
                                    factory.visualisationName,
                                    this.currentVisitedSourceFile!.absolutePath,
                                    node.start.line
                                );

                            const combinedPathAndLineNumber = combinePathAndLineNumber(
                                this.currentVisitedSourceFile!.absolutePath,
                                node.start.line
                            );

                            // TODO: handle the case in which multiple matches are linked
                            // to mappings pointing to the same file and the same line

                            // if (!absolutePathAndLineNumberToCount.has(combinePathAndLineNumber)) {
                            //     absolutePathAndLineNumberToCount.set(combinePathAndLineNumber, 0);
                            // }

                            // let nbModelsWithMappingAtSameLocation = 0;
                            // if (mappings.length > 1) {
                            //     nbModelsWithMappingAtSameLocation =
                            //         absolutePathAndLineNumberToCount.get(
                                        
                            //         ) ?? 0;
                            // }

                            // .

                            if (mappings.length === 0) {
                                console.error(`There is no mapping for the code pattern at ${combinePathAndLineNumber}`);
                                return;
                            }

                            this.visualisationModels.push(
                                factory.createModel(
                                    node,
                                    // mappings.slice(nbModelsWithMappingAtSameLocation),
                                    mappings[0],
                                    utilities)
                            );
                        }
                    };
                })
        );
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

    extractNewModels(): void {
        this.visualisationModels = [];
        
        const sourceFiles = this.ilatex.codeMappingManager.allSourceFiles;
        for (let sourceFile of sourceFiles) {
            this.currentVisitedSourceFile = sourceFile;
            sourceFile.ast.visitWith(this.patternDetector);
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