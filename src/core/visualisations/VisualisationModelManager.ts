import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { VisualisationModelUID } from "../../shared/visualisations/types";
import { CodeMappingID } from "../code-mappings/CodeMapping";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { SourceFileRange } from "../source-files/SourceFileRange";
import { VisualisationModelExtractor } from "./extractors/VisualisationModelExtractor";
import { VisualisationModel } from "./VisualisationModel";

export class VisualisationModelManager {
    private ilatex: InteractiveLatex;

    private visualisationModels: VisualisationModel[];
    private visualisationModelsExtractor: VisualisationModelExtractor;

    readonly modelMetadataChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly modelContentChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly modelChangeEventEmitter: vscode.EventEmitter<VisualisationModel[]>;

    private modelObserverDisposables: vscode.Disposable[];

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.visualisationModels = [];
        this.visualisationModelsExtractor = new VisualisationModelExtractor(ilatex);

        this.modelMetadataChangeEventEmitter = new vscode.EventEmitter();
        this.modelContentChangeEventEmitter = new vscode.EventEmitter();
        this.modelChangeEventEmitter = new vscode.EventEmitter();

        this.modelObserverDisposables = [];
    }

    get models(): VisualisationModel[] {
        return this.visualisationModels;
    }
    
    get contentOfAllModels(): string {
        return this.models
            .map(visualisation => visualisation.content)
            .join("\n");
    }

    findModelWithUid(uid: VisualisationModelUID): VisualisationModel | undefined {
        return this.models.find(model => model.uid === uid);
    }

    findModelWithCodeMappingId(id: CodeMappingID): VisualisationModel | undefined {
        return this.models.find(model => model.codeMapping.id === id);
    }

    findModelContainingRange(range: SourceFileRange): VisualisationModel | undefined {
        return this.models.find(model => model.codeRange.contains(range));
    }

    findModelIntersectingRange(range: SourceFileRange): VisualisationModel | undefined {
        return this.models.find(model => model.codeRange.intersects(range));
    }


    dispose(): void {
        
    }

    async dispatchWebviewMessage(message: NotifyVisualisationModelMessage): Promise<void> {
        const model = this.findModelWithUid(message.visualisationUid);
        if (!model) {
            console.error(`The notification cannot be dispatched: there is no model with UID "${message.visualisationUid}".`);
            return;
        }

        return model.processViewMessage(message);
    }

    private startObservingModels(): void {
        for (let model of this.models) {
            this.modelObserverDisposables.push(
                model.metadataChangeEventEmitter.event(model => {
                    this.modelMetadataChangeEventEmitter.fire(model);
                    this.ilatex.webviewManager.sendNewVisualisationMetadataFor(model);
                }
            ));

            this.modelObserverDisposables.push(
                model.contentChangeEventEmitter.event(model => {
                    this.modelContentChangeEventEmitter.fire(model);
                    this.ilatex.webviewManager.sendNewVisualisationContentFor(model);
                }
            ));
        }
    }

    private stopObservingModels(): void {
        for (let disposable of this.modelObserverDisposables) {
            disposable.dispose();
        }
    }

    private disposeOfAllModels(): void {
        this.stopObservingModels();

        for (let model of this.models) {
            model.dispose();
        }
    }

    async extractNewModels(): Promise<void> {
        this.disposeOfAllModels();
        this.visualisationModels = this.visualisationModelsExtractor.extractModelsForAllSourceFiles();
        this.startObservingModels();

        // Finish initialising every new model
        for (let model of this.visualisationModels) {
            await model.init();
        }

        this.modelChangeEventEmitter.fire(this.models);

        console.log("New visualisation models have been extracted:");
        for (let model of this.models) {
            console.log(`UID ${model.uid}\tMapping ${model.uid}\t${model.name.padEnd(16)}\t${model.sourceFile.name} (line ${model.codeMapping.lineNumber})`);
        }
    }
}