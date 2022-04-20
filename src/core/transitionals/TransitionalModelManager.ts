import * as vscode from "vscode";
import { NotifyTransitionalModelMessage } from "../../shared/messenger/messages";
import { TransitionalModelUID } from "../../shared/transitionals/types";
import { CodeMappingID } from "../code-mappings/CodeMapping";
import { InteractiveLatexDocument } from "../InteractiveLatexDocument";
import { SourceFileRange } from "../source-files/SourceFileRange";
import { TransitionalModelExtractor } from "./extractors/TransitionalModelExtractor";
import { TransitionalModel } from "./TransitionalModel";

export class TransitionalModelManager {
    private ilatexDocument: InteractiveLatexDocument;

    private transitionalModels: TransitionalModel[];
    private transitionalModelsExtractor: TransitionalModelExtractor;

    readonly modelMetadataChangeEventEmitter: vscode.EventEmitter<TransitionalModel>;
    readonly modelContentChangeEventEmitter: vscode.EventEmitter<TransitionalModel>;
    readonly modelChangeEventEmitter: vscode.EventEmitter<TransitionalModel[]>;

    private modelObserverDisposables: vscode.Disposable[];

    constructor(ilatexDocument: InteractiveLatexDocument) {
        this.ilatexDocument = ilatexDocument;

        this.transitionalModels = [];
        this.transitionalModelsExtractor = new TransitionalModelExtractor(ilatexDocument);

        this.modelMetadataChangeEventEmitter = new vscode.EventEmitter();
        this.modelContentChangeEventEmitter = new vscode.EventEmitter();
        this.modelChangeEventEmitter = new vscode.EventEmitter();

        this.modelObserverDisposables = [];
    }

    get models(): TransitionalModel[] {
        return this.transitionalModels;
    }
    
    get contentOfAllModels(): string {
        return this.models
            .map(model => model.content)
            .join("\n");
    }

    findModelWithUid(uid: TransitionalModelUID): TransitionalModel | undefined {
        return this.transitionalModels.find(model => model.uid === uid);
    }

    findModelWithCodeMappingId(id: CodeMappingID): TransitionalModel | undefined {
        return this.transitionalModels.find(model => model.codeMapping.id === id);
    }

    findModelContainingRange(range: SourceFileRange): TransitionalModel | undefined {
        return this.transitionalModels.find(model => model.codeRange.contains(range));
    }

    findModelIntersectingRange(range: SourceFileRange): TransitionalModel | undefined {
        return this.transitionalModels.find(model => model.codeRange.intersects(range));
    }


    dispose(): void {
        
    }

    async dispatchWebviewMessage(message: NotifyTransitionalModelMessage): Promise<void> {
        const model = this.findModelWithUid(message.transitionalUid);
        if (!model) {
            console.error(`The notification cannot be dispatched: there is no model with UID "${message.transitionalUid}".`);
            return;
        }

        return model.processViewMessage(message);
    }

    private startObservingModels(): void {
        for (let model of this.transitionalModels) {
            this.modelObserverDisposables.push(
                model.metadataChangeEventEmitter.event(model => {
                    this.modelMetadataChangeEventEmitter.fire(model);
                    this.ilatexDocument.webviewManager.sendNewTransitionalMetadataFor(model);
                }
            ));

            this.modelObserverDisposables.push(
                model.contentChangeEventEmitter.event(model => {
                    this.modelContentChangeEventEmitter.fire(model);
                    this.ilatexDocument.webviewManager.sendNewTransitionalContentFor(model);
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

        for (let model of this.transitionalModels) {
            model.dispose();
        }
    }

    async extractNewModels(): Promise<void> {
        this.disposeOfAllModels();
        this.transitionalModels = this.transitionalModelsExtractor.extractModelsForAllSourceFiles();
        this.startObservingModels();

        // Finish initialising every new model
        for (let model of this.transitionalModels) {
            await model.init();
        }

        this.modelChangeEventEmitter.fire(this.transitionalModels);

        console.log("New transitional models have been extracted:");
        for (let model of this.transitionalModels) {
            console.log(`UID ${model.uid}\tMapping ${model.uid}\t${model.name.padEnd(16)}\t${model.sourceFile.name} (line ${model.codeMapping.lineNumber})`);
        }
    }
}