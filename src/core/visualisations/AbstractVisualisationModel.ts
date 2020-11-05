import * as vscode from "vscode";
import { VisualisationModel, ModelUID, ModelIDGenerator, VisualisationModelUtilities } from "./VisualisationModel";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTNode } from "../ast/LatexASTNode";
import { HtmlUtils } from "../../shared/utils/HtmlUtils";
import { CodeMapping, CodeMappingID } from "../mappings/CodeMapping";

export type NotificationHandler = (notification: any) => Promise<void>;
export interface NotificationHandlerSpecification {
    title: string;
    handler: NotificationHandler
}

export abstract class AbstractVisualisationModel<T extends ASTNode> implements VisualisationModel {
    abstract readonly visualisationName: string;
    readonly uid: ModelUID;

    protected readonly astNode: T;
    protected readonly codeMapping: CodeMapping;
    protected readonly utilities: VisualisationModelUtilities;

    private notificationTitlesToHandlers: Map<string, NotificationHandler>;

    constructor(node: T, codeMapping: CodeMapping, utilities: VisualisationModelUtilities) {
        this.uid = ModelIDGenerator.getUniqueId();

        this.astNode = node;
        this.codeMapping = codeMapping;
        this.utilities = utilities;

        this.notificationTitlesToHandlers = new Map(
            this.createNotificationHandlerSpecifications()
                .map(specification  => [specification.title, specification.handler])
        );
    }

    get codeMappingId(): CodeMappingID {
        return this.codeMapping.id;
    }

    private async saveMappedSourceFile(): Promise<void> {
        const sourceFile = await this.codeMapping.sourceFile;
        await sourceFile.saveDocument();
    }

    private async revealCodeInEditor(): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();

        // Select the code
        const startPosition = new vscode.Position(this.astNode.start.line - 1, this.astNode.start.column - 1);
        const endPosition = new vscode.Position(this.astNode.end.line - 1, this.astNode.end.column - 1);
        editor.selections = [new vscode.Selection(startPosition, endPosition)];

        // If the selected range is not visible, scroll to the selection
        editor.revealRange(
            new vscode.Range(startPosition, endPosition),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            {
                title: "reveal-code",
                handler: async notifiction => {
                    this.revealCodeInEditor();
                }
            },
            {
                title: "save-source-document",
                handler: async notifiction => {
                    this.saveMappedSourceFile();
                }
            }
        ];
    }

    protected createContentAttributes(): Record<string, string> {
        return {
            "class": "visualisation",
            "data-name": this.visualisationName,
            "data-uid": this.uid.toString(),
            "data-code-mapping-id": this.codeMapping.id.toString(),
            "data-code-start-position": `${this.astNode.start.line};${this.astNode.start.column}`,
            "data-code-end-position": `${this.astNode.end.line};${this.astNode.end.column}`
        };
    }

    protected requestNewParsing(): void {
        this.utilities.requestNewParsingOf(this.codeMapping.sourceFile);
    }

    async handleViewNotification(message: NotifyVisualisationModelMessage): Promise<void> {
        const title = message.title;
        if (!this.notificationTitlesToHandlers.has(title)) {
            console.error(`There is no notification handler for notifications titled "${title}"`);
            return;
        }

        const handler = this.notificationTitlesToHandlers.get(title)!;
        await handler(message.notification);
    }

    protected abstract renderContentAsHTML(): string;

    createViewContent(): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf(
            this.createContentAttributes()
        );

        return `
            <div ${attributes}>
                ${this.renderContentAsHTML()}
            </div>
        `;
    }
}