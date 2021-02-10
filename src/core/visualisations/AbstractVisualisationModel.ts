import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { HtmlUtils } from "../../shared/utils/HtmlUtils";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { VisualisationContent, VisualisationModel, VisualisationModelUID, VisualisationStatus } from "./VisualisationModel";
import { VisualisableCodeContext } from "./VisualisationModelProvider";
import { VisualisationModelUtilities } from "./VisualisationModelUtilities";


export type ViewMessageHandler = (notification: any) => Promise<void>;
export interface ViewMessageHandlerSpecification {
    title: string;
    handler: ViewMessageHandler
}

abstract class VisualisationModelUIDGenerator {
    private static maxUsedValue: number = 0;
    
    static getUniqueId(): VisualisationModelUID {
        VisualisationModelUIDGenerator.maxUsedValue += 1;
        return this.maxUsedValue;
    }
}

/** A flag indicating whether a model content update was successful (`true`) or not (`false`). */
export type VisualisationModelContentUpdateResult = boolean;

export abstract class AbstractVisualisationModel<T extends ASTNode> implements VisualisationModel {
    abstract readonly name: string;
    readonly uid: VisualisationModelUID;
    private readonly context: VisualisableCodeContext<T>;
    protected readonly utilities: VisualisationModelUtilities;
    
    protected abstract contentDataAsHtml: string;

    private astNodeHasBeenDetached: boolean;
    private lastContentUpdateFailed: boolean;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly statusChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    protected contentUpdateEndEventEmitter: vscode.EventEmitter<VisualisationModelContentUpdateResult>;
    
    private viewMessageTitlesToHandlers: Map<string, ViewMessageHandler>;

    private contentUpdateEndObserverDisposable: vscode.Disposable;
    private astNodeChangeObserverDisposable: vscode.Disposable;
    private astNodeDetachmentObserverDisposable: vscode.Disposable;

    constructor(context: VisualisableCodeContext<T>, utilities: VisualisationModelUtilities) {
        this.uid = VisualisationModelUIDGenerator.getUniqueId();
        this.context = context;
        this.utilities = utilities;

        this.astNodeHasBeenDetached = false;
        this.lastContentUpdateFailed = false;

        this.viewDidOpenEventEmitter = new vscode.EventEmitter();
        this.viewDidCloseEventEmitter = new vscode.EventEmitter();
        this.statusChangeEventEmitter = new vscode.EventEmitter();
        this.contentChangeEventEmitter = new vscode.EventEmitter();
        this.contentUpdateEndEventEmitter = new vscode.EventEmitter();

        this.viewMessageTitlesToHandlers = new Map(
            this.viewMessageHandlerSpecifications.map(specification => [specification.title, specification.handler])
        );

        this.contentUpdateEndObserverDisposable =
            this.contentUpdateEndEventEmitter.event(async updateSuccess => {
                if (updateSuccess) {
                    this.lastContentUpdateFailed = false;
                    this.contentChangeEventEmitter.fire(this);
                }
                else {
                    this.lastContentUpdateFailed = true;
                    this.contentChangeEventEmitter.fire(this);
                    this.statusChangeEventEmitter.fire(this);
                }
            });

        this.astNodeChangeObserverDisposable =
            this.astNode.textContentChangeEventEmitter.event(async node => {
                this.updateContentData();
            });

        this.astNodeDetachmentObserverDisposable =
            this.astNode.beforeNodeDetachmentEventEmitter.event(async node => {
                this.astNodeHasBeenDetached = true;
                this.statusChangeEventEmitter.fire(this);
            });
    }

    async init(): Promise<void> {
        this.updateContentData();
    };

    get sourceFile(): SourceFile {
        return this.context.sourceFile;
    }

    get codeMapping(): CodeMapping {
        return this.context.codeMapping;
    }

    get astNode(): T {
        return this.context.astNode;
    }

    get status(): VisualisationStatus {
        return {
            available: !this.lastContentUpdateFailed && !this.astNodeHasBeenDetached
        };
    }

    get content(): VisualisationContent {
        return this.contentAsHtml;
    }

    protected get contentAsHtml(): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf(this.contentHtmlAttributes);
        return `<div ${attributes}>${this.contentDataAsHtml}</div>`;
    }

    protected get contentHtmlAttributes(): Record<string, string> {
        return {
            "class": "visualisation",
            "data-name": this.name,
            "data-uid": this.uid.toString(),
            "data-code-mapping-id": this.codeMapping.id.toString(),
            "data-source-file-name": this.sourceFile.name,
            "data-code-start-position": `${this.astNode.range.from.line};${this.astNode.range.from.column}`,
            "data-code-end-position": `${this.astNode.range.to.line};${this.astNode.range.to.column}`
        };
    }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            {
                title: "reveal-code-in-editor",
                handler: async notifiction => {
                    await this.astNode.selectRangeInEditor();
                }
            },
            {
                title: "view-popup-did-open",
                handler: async notifiction => {
                    this.viewDidOpenEventEmitter.fire(this);
                }
            },
            {
                title: "view-popup-did-close",
                handler: async notifiction => {
                    this.viewDidCloseEventEmitter.fire(this);

                    // If the visualisation is available, save the source file of this visualisation
                    // TODO: only save the document if it was modified
                    if (this.status.available) {
                        await this.sourceFile.save();
                    }
                }
            }
        ];
    }

    dispose(): void {
        this.contentUpdateEndObserverDisposable.dispose();
        this.astNodeChangeObserverDisposable.dispose();
        this.astNodeDetachmentObserverDisposable.dispose();
    }

    protected abstract updateContentData(): Promise<void>;

    async processViewMessage(message: NotifyVisualisationModelMessage): Promise<void> {
        const title = message.title;
        if (!this.viewMessageTitlesToHandlers.has(title)) {
            console.error(`There is no notification handler for notifications titled "${title}".`);
            return;
        }

        const handler = this.viewMessageTitlesToHandlers.get(title)!;
        await handler(message.notification);
    }
}