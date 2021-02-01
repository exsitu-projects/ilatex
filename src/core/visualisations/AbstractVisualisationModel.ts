import * as vscode from "vscode";
import { VisualisationModel, ModelUID, ModelIDGenerator, VisualisationModelUtilities } from "./VisualisationModel";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTCommandNode, ASTEnvironementNode, ASTNode, ASTNodeType } from "../ast/LatexASTNode";
import { HtmlUtils } from "../../shared/utils/HtmlUtils";
import { CodeMapping, CodeMappingID } from "../mappings/CodeMapping";
import { SourceFile } from "../mappings/SourceFile";

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

    readonly onModelChangeEventEmitter: vscode.EventEmitter<this>;

    constructor(node: T, codeMapping: CodeMapping, utilities: VisualisationModelUtilities) {
        this.uid = ModelIDGenerator.getUniqueId();

        this.astNode = node;
        this.codeMapping = codeMapping;
        this.utilities = utilities;

        this.notificationTitlesToHandlers = new Map(
            this.createNotificationHandlerSpecifications()
                .map(specification  => [specification.title, specification.handler])
        );

        this.onModelChangeEventEmitter = new vscode.EventEmitter();
    }

    get codeMappingId(): CodeMappingID {
        return this.codeMapping.id;
    }

    get sourceFile(): SourceFile {
        return this.codeMapping.sourceFile;
    }

    // This accessor is implemented with a default behaviour
    // It should be overriden if needed to ensure it always return the range of
    // the entire piece of code manipulated by the visualisation
    get codeRange(): vscode.Range {
        return this.astNode.range.asVscodeRange;
    }

    get isOutOfSyncWithCode(): boolean {
        return this.astNode.hasBeenEditedByTheUser;
    }

    private async saveMappedSourceFile(): Promise<void> {
        const sourceFile = await this.codeMapping.sourceFile;
        await sourceFile.saveDocument();
    }

    private async revealCodeInEditor(): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();

        // Select the code
        editor.selections = [new vscode.Selection(
            this.astNode.range.from.asVscodePosition,
            this.astNode.range.to.asVscodePosition,
        )];

        // If the selected range is not visible, scroll to the selection
        editor.revealRange(
            this.astNode.range.asVscodeRange,
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
            "data-source-file-name": this.sourceFile.name,
            "data-code-start-position": `${this.astNode.range.from.line};${this.astNode.range.from.column}`,
            "data-code-end-position": `${this.astNode.range.to.line};${this.astNode.range.to.column}`
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