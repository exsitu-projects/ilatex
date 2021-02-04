import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { CodeMappingID } from "../code-mappings/CodeMapping";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { VisualisationModelExtractor } from "./extractors/VisualisationModelExtractor";
import { VisualisationModel, VisualisationModelUID } from "./VisualisationModel";

export class VisualisationModelManager {
    private ilatex: InteractiveLatex;

    private visualisationModels: VisualisationModel[];
    private visualisationModelsExtractor: VisualisationModelExtractor;

    readonly modelStatusChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly modelContentChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly modelChangeEventEmitter: vscode.EventEmitter<VisualisationModel[]>;

    private modelObserverDisposables: vscode.Disposable[];

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.visualisationModels = [];
        this.visualisationModelsExtractor = new VisualisationModelExtractor(ilatex);

        this.modelStatusChangeEventEmitter = new vscode.EventEmitter();
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
                model.statusChangeEventEmitter.event(model => {
                    this.modelStatusChangeEventEmitter.fire(model);
                    this.ilatex.webviewManager.sendNewStatusForOneVisualisation(model);
                }
            ));

            this.modelObserverDisposables.push(
                model.contentChangeEventEmitter.event(model => {
                    this.modelStatusChangeEventEmitter.fire(model);
                    this.ilatex.webviewManager.sendNewContentForOneVisualisation(model);
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

    extractNewModels(): void {
        this.disposeOfAllModels();

        this.visualisationModels = this.visualisationModelsExtractor.extractModelsForAllSourceFiles();
        this.startObservingModels();

        this.modelChangeEventEmitter.fire(this.models);
    }
}