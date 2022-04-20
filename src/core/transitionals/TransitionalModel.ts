import * as vscode from "vscode";
import { NotifyTransitionalModelMessage } from "../../shared/messenger/messages";
import { HtmlUtils } from "../../shared/utils/HtmlUtils";
import { TransitionalModelUID, TransitionalContent, TransitionalMetadata } from "../../shared/transitionals/types";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { SourceFileRange } from "../source-files/SourceFileRange";
import { VisualisableCodeContext } from "./TransitionalModelProvider";
import { TransitionalModelUtilities } from "./TransitionalModelUtilities";


export type ViewMessageHandler = (notification: any) => Promise<void>;
export interface ViewMessageHandlerSpecification {
    title: string;
    handler: ViewMessageHandler
}

abstract class TransitionalModelUIDGenerator {
    private static maxUsedValue: number = 0;
    
    static getUniqueId(): TransitionalModelUID {
        TransitionalModelUIDGenerator.maxUsedValue += 1;
        return this.maxUsedValue;
    }
}

/** A flag indicating whether a model content update was successful (`true`) or not (`false`). */
export type TransitionalModelContentUpdateResult = boolean;

export abstract class TransitionalModel<T extends ASTNode = ASTNode> {
    abstract readonly transitionalName: string;
    readonly uid: TransitionalModelUID;
    private readonly context: VisualisableCodeContext<T>;
    protected readonly utilities: TransitionalModelUtilities;
    
    protected abstract contentDataAsHtml: string;

    private viewPerformedUnsavedChanges: boolean;
    private lastContentUpdateFailed: boolean;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<TransitionalModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<TransitionalModel>;
    readonly metadataChangeEventEmitter: vscode.EventEmitter<TransitionalModel>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<TransitionalModel>;
    protected contentUpdateEndEventEmitter: vscode.EventEmitter<TransitionalModelContentUpdateResult>;
    
    private viewMessageTitlesToHandlers: Map<string, ViewMessageHandler>;

    private contentUpdateObserverDisposable: vscode.Disposable;
    private astNodeObserversDisposables: vscode.Disposable[];

    constructor(context: VisualisableCodeContext<T>, utilities: TransitionalModelUtilities) {
        this.uid = TransitionalModelUIDGenerator.getUniqueId();
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

    get metadata(): TransitionalMetadata {
        return {
            // General data
            name: this.transitionalName,
            uid: this.uid,
            codeMappingId: this.codeMapping.id,
            available: !this.astNode.requiresReparsing && !this.lastContentUpdateFailed,

            // Data about the source file that contains the code
            absoluteFilePath: this.sourceFile.uri.path,
            fileName: this.sourceFile.name,

            // Location of the code within the source file
            codeRange: this.astNode.range.raw,
        };
    }

    get content(): TransitionalContent {
        return this.contentAsHtml;
    }

    protected get contentAsHtml(): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf(this.contentHtmlAttributes);
        return `<div ${attributes}>${this.contentDataAsHtml}</div>`;
    }

    protected get contentHtmlAttributes(): Record<string, string> {
        // TODO: remove the useless attributes
        return {
            "class": "transitional",
            "data-name": this.transitionalName,
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
                    await this.astNode.selectRangeInEditor(true);
                    this.logEvent("reveal-code-in-editor");
                }
            },
            {
                title: "view-popup-did-open",
                handler: async notifiction => {
                    this.viewDidOpenEventEmitter.fire(this);
                    this.logEvent("display-transitional");
                }
            },
            {
                title: "view-popup-did-close",
                handler: async notifiction => {
                    this.viewDidCloseEventEmitter.fire(this);
                    this.logEvent("hide-transitional");

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
        let lastAstNodeRecompilationFailed = false;

        this.astNodeObserversDisposables.push(
            this.astNode.rangeChangeEventEmitter.event(async () => {
                this.metadataChangeEventEmitter.fire(this);
            }),
            
            this.astNode.contentChangeEventEmitter.event(async nodeUpdateResult => {
                if (nodeUpdateResult.success) {
                    await this.updateContentData();
                    
                    if (lastAstNodeRecompilationFailed) {
                        this.logEvent("recompilation-failure-fixed");
                    }
                    lastAstNodeRecompilationFailed = false;
                }
                else {
                    this.metadataChangeEventEmitter.fire(this);
                    
                    if (!lastAstNodeRecompilationFailed) {
                        this.logEvent("recompilation-failure");
                    }
                    lastAstNodeRecompilationFailed = true;
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
            transitionalUid: metadata.uid,
            transitionalCodeMappingId: metadata.codeMappingId,
            transitionalName: metadata.name
        });
    }

    protected abstract updateContentData(): Promise<void>;

    async processViewMessage(message: NotifyTransitionalModelMessage): Promise<void> {
        const title = message.title;
        if (!this.viewMessageTitlesToHandlers.has(title)) {
            console.error(`There is no notification handler for notifications titled "${title}".`);
            return;
        }

        const handler = this.viewMessageTitlesToHandlers.get(title)!;
        await handler(message.notification);
    }
}