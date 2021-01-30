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

    get sourceFile(): SourceFile {
        return this.codeMapping.sourceFile;
    }

    // This accessor is implemented with a default behaviour
    // It should be overriden if needed to ensure it always return the range of
    // the entire piece of code manipulated by the visualisation
    get codeRange(): vscode.Range {
        return this.astNode.range.asVscodeRange;
    }

    get hasBeenManuallyEdited(): boolean {
        return this.astNode.hasBeenEditedByTheUser;
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
        const firstParameterStart = parameters.find(specifiedParameter => specifiedParameter.length > 0)![0].range.from;
        const lastParameterEnd = [...parameters]
            .reverse()
            .find(specifiedParameter => specifiedParameter.length > 0)![0].range.to;

        return new vscode.Range(
            firstParameterStart.asVscodePosition,
            lastParameterEnd.asVscodePosition
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
            ? firstExistingParameter[0].range.from
            : body.range.from;
        const endPosition = body.range.to;

        return new vscode.Range(
            startPosition.asVscodePosition,
            endPosition.asVscodePosition
        ).contains(range);
    }
}