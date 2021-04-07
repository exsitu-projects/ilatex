import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { HtmlUtils } from "../../shared/utils/HtmlUtils";
import { VisualisationModelUID, VisualisationContent, VisualisationMetadata } from "../../shared/visualisations/types";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { SourceFileRange } from "../source-files/SourceFileRange";
import { VisualisationModel } from "./VisualisationModel";
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

    private viewPerformedUnsavedChanges: boolean;
    private lastContentUpdateFailed: boolean;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly metadataChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    protected contentUpdateEndEventEmitter: vscode.EventEmitter<VisualisationModelContentUpdateResult>;
    
    private viewMessageTitlesToHandlers: Map<string, ViewMessageHandler>;

    private contentUpdateObserverDisposable: vscode.Disposable;
    private astNodeObserversDisposables: vscode.Disposable[];

    constructor(context: VisualisableCodeContext<T>, utilities: VisualisationModelUtilities) {
        this.uid = VisualisationModelUIDGenerator.getUniqueId();
        this.context = context;
        this.utilities = utilities;

        this.viewPerformedUnsavedChanges = false;
        this.lastContentUpdateFailed = false;

        this.viewDidOpenEventEmitter = new vscode.EventEmitter();
        this.viewDidCloseEventEmitter = new vscode.EventEmitter();
        this.metadataChangeEventEmitter = new vscode.EventEmitter();
        this.contentChangeEventEmitter = new vscode.EventEmitter();
        this.contentUpdateEndEventEmitter = new vscode.EventEmitter();

        this.viewMessageTitlesToHandlers = new Map(
            this.viewMessageHandlerSpecifications.map(specification => [specification.title, specification.handler])
        );

        this.contentUpdateObserverDisposable =
            this.contentUpdateEndEventEmitter.event(async updateSuccess => {
                if (updateSuccess) {
                    this.lastContentUpdateFailed = false;
                    this.contentChangeEventEmitter.fire(this);
                    this.metadataChangeEventEmitter.fire(this);
                }
                else {
                    this.lastContentUpdateFailed = true;
                    this.metadataChangeEventEmitter.fire(this);
                }
            });

        this.astNodeObserversDisposables = [];
        this.startObservingAstNode();
    }

    async init(): Promise<void> {
        this.astNode.enableReparsing = true;

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

    get codeRange(): SourceFileRange {
        return this.astNode.range;
    }

    get metadata(): VisualisationMetadata {
        return {
            // General data about this visualisation
            name: this.name,
            uid: this.uid,
            codeMappingId: this.codeMapping.id,

            available: !this.astNode.requiresReparsing && !this.lastContentUpdateFailed,

            // Data about the source file that contains the visualisable code
            absoluteFilePath: this.sourceFile.uri.path,
            fileName: this.sourceFile.name,

            // Data about the location of the visualisable code within the source file
            codeRange: this.astNode.range.raw,
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
        // TODO: remove the useless attributes
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
                    this.logEvent("reveal-code-in-editor");
                }
            },
            {
                title: "view-popup-did-open",
                handler: async notifiction => {
                    this.viewDidOpenEventEmitter.fire(this);
                    this.logEvent("display-visualisation");
                }
            },
            {
                title: "view-popup-did-close",
                handler: async notifiction => {
                    this.viewDidCloseEventEmitter.fire(this);
                    this.logEvent("hide-visualisation");

                    // Only save the document if the view performed at least one change
                    if (this.viewPerformedUnsavedChanges) {
                        await this.sourceFile.save();
                    }
                }
            }
        ];
    }

    // This method must be called everytime a model performs a change requested by the view
    protected registerChangeRequestedByTheView(): void {
        this.viewPerformedUnsavedChanges = true;
    }

    protected startObservingAstNode(): void {
        this.astNodeObserversDisposables.push(
            this.astNode.rangeChangeEventEmitter.event(async () => {
                this.metadataChangeEventEmitter.fire(this);
            }),

            this.astNode.contentChangeEventEmitter.event(async nodeUpdateResult => {
                if (nodeUpdateResult.success) {
                    await this.updateContentData();
                }
                else {
                    this.metadataChangeEventEmitter.fire(this);
                }
            })
        );
    }

    protected stopObservingAstNode(): void {
        for (let disposable of this.astNodeObserversDisposables) {
            disposable.dispose();
        }
    }

    dispose(): void {
        this.contentUpdateObserverDisposable.dispose();
        this.stopObservingAstNode();
    }

    protected logEvent(event: string): void {
        const metadata = this.metadata;
        this.utilities.logEvent({
            event: event,
            fileName: metadata.fileName,
            visualisationUid: metadata.uid,
            visualisationCodeMappingId: metadata.codeMappingId,
            visualisationName: metadata.name
        });
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