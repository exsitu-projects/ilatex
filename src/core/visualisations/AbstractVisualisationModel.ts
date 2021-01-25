import * as vscode from "vscode";
import { VisualisationModel, ModelUID, ModelIDGenerator, VisualisationModelUtilities } from "./VisualisationModel";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTCommandNode, ASTEnvironementNode, ASTNode, ASTNodeType } from "../ast/LatexASTNode";
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

    // This method is implemented with a default behaviour
    // It should be overriden if a visualisation model requires to perform different tests
    // to decide whether it is capable to handle the changes in the range within the file locatrd at the given path
    isAbleToHandleChangeIn(filePath: string, range: vscode.Range): boolean {
        // The change must happen in the same file than the file
        // where the code mapping of this visualisation is located
        if (this.codeMapping.sourceFile.absolutePath !== filePath) {
            return false;
        }

        if (this.astNode.type === ASTNodeType.Command) {
            const astNode = this.astNode as ASTCommandNode;
            return AbstractVisualisationModel.isCommandNodeAbleToHandleChangeInRange(astNode, range);
        }

        
        if (this.astNode.type === ASTNodeType.Environement) {
            const astNode = this.astNode as ASTEnvironementNode;
            return AbstractVisualisationModel.isEnvironementNodeAbleToHandleChangeInRange(astNode, range);
        }

        // Otherwise, this method should be overriden (and returns false by default)
        return false;
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

    // If a model is tied to a command, it should by default handle changes in its arguments
    // Note: this method assumes the range is in the same file than the given AST node!
    protected static isCommandNodeAbleToHandleChangeInRange(node: ASTCommandNode, range: vscode.Range): boolean {
        const parameters = node.value.parameters;

        // If there are no parameters (expected or found), no argument can change
        // Reminder: a 0-length node array is used to represent an absent parameter in the parser
        if (parameters.length === 0 || parameters.every(specifiedParameter => specifiedParameter.length === 0)) {
            return false;
        }

        // If there is at least one parameter, the change must occur
        // between the start of the first one and the end of the last one
        const firstParameterStart = parameters.find(specifiedParameter => specifiedParameter.length > 0)![0].start;
        const lastParameterEnd = [...parameters]
            .reverse()
            .find(specifiedParameter => specifiedParameter.length > 0)![0].end;

        return new vscode.Range(
            new vscode.Position(firstParameterStart.line - 1, firstParameterStart.column - 1),
            new vscode.Position(lastParameterEnd.line - 1, lastParameterEnd.column - 1)
        ).contains(range);
    }

    // If a model is tied to an environement, it should by default handle changes in its arguments or its body
    // Note: this method assumes the range is in the same file than the given AST node!
    protected static isEnvironementNodeAbleToHandleChangeInRange(node: ASTEnvironementNode, range: vscode.Range): boolean {
        const body = node.value.content;
        const parameters = node.value.parameters;

        // The change must occur between the start of the first existing argument
        // (or the start of the body if there is none) and the end of body
        const firstExistingParameter = parameters.find(specifiedParameter => specifiedParameter.length > 0);
        const startPosition = firstExistingParameter !== undefined
            ? firstExistingParameter[0].start
            : body.start;
        const endPosition = body.end;

        return new vscode.Range(
            new vscode.Position(startPosition.line - 1, startPosition.column - 1),
            new vscode.Position(endPosition.line - 1, endPosition.column - 1)
        ).contains(range);
    }
}