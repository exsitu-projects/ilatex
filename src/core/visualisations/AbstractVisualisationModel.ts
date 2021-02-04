import * as vscode from "vscode";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { HtmlUtils } from "../../shared/utils/HtmlUtils";
import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { VisualisationContent, VisualisationModel, VisualisationModelUID } from "./VisualisationModel";
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

export abstract class AbstractVisualisationModel<T extends ASTNode> implements VisualisationModel {
    abstract readonly name: string;
    readonly uid: VisualisationModelUID;
    private readonly context: VisualisableCodeContext<T>;
    protected readonly utilities: VisualisationModelUtilities;

    readonly viewDidOpenEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly viewDidCloseEventEmitter: vscode.EventEmitter<VisualisationModel>;
    readonly availabilityChangeEventEmitter: vscode.EventEmitter<VisualisationModel>;
    
    private viewMessageTitlesToHandlers: Map<string, ViewMessageHandler>;

    constructor(context: VisualisableCodeContext<T>, utilities: VisualisationModelUtilities) {
        this.uid = VisualisationModelUIDGenerator.getUniqueId();
        this.context = context;
        this.utilities = utilities;

        this.viewDidOpenEventEmitter = new vscode.EventEmitter();
        this.viewDidCloseEventEmitter = new vscode.EventEmitter();
        this.availabilityChangeEventEmitter = new vscode.EventEmitter();

        this.viewMessageTitlesToHandlers = new Map(
            this.viewMessageHandlerSpecifications.map(specification => [specification.title, specification.handler])
        );
    }     

    get sourceFile(): SourceFile {
        return this.context.sourceFile;
    }

    get codeMapping(): CodeMapping {
        return this.context.codeMapping;
    }

    get astNode(): T {
        return this.context.astNode;
    }

    get content(): VisualisationContent {
        return this.contentAsHtml;
    }

    get isAvailable(): boolean {
        // TODO: implement
        return false;
    }

    protected get contentAsHtml(): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf(this.contentHtmlAttributes);
        return `<div ${attributes}>${this.contentAsHtml}</div>`;
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
                    await this.astNode.revealInEditor();
                }
            },
            {
                title: "view-did-open",
                handler: async notifiction => {
                    this.viewDidOpenEventEmitter.fire(this);
                }
            },
            {
                title: "view-did-close",
                handler: async notifiction => {
                    this.viewDidCloseEventEmitter.fire(this);
                }
            }
        ];
    }

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