import * as vscode from 'vscode';
import { VisualisationModel, ModelID, SourceIndex, ModelIDGenerator, SourceIndexCounter } from "./VisualisationModel";
import { NotifyVisualisationModelMessage } from "../../shared/messenger/messages";
import { ASTNode } from "../ast/LatexASTNode";
import { InteractiveLaTeX } from '../InteractiveLaTeX';
import { WebviewManager } from '../webview/WebviewManager';

export type NotificationHandler = (notification: any) => Promise<void>;
export interface NotificationHandlerSpecification {
    title: string;
    handler: NotificationHandler
}

export abstract class AbstractVisualisationModel<T extends ASTNode> implements VisualisationModel {
    abstract readonly visualisationName: string;
    readonly id: ModelID;
    readonly sourceIndex: SourceIndex;

    protected readonly ilatex: InteractiveLaTeX;
    protected readonly editor: vscode.TextEditor;
    protected readonly webviewManager: WebviewManager;

    protected readonly astNode: T;
    private notificationTitlesToHandlers: Map<string, NotificationHandler>;

    constructor(node: T, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        this.id = ModelIDGenerator.getUniqueId();
        this.sourceIndex = SourceIndexCounter.getNextSourceIndex();

        this.ilatex = ilatex;
        this.editor = editor;
        this.webviewManager = webviewManager;

        this.astNode = node;
        this.notificationTitlesToHandlers = new Map(
            this.createNotificationHandlerSpecifications()
                .map(specification  => [specification.title, specification.handler])
        );
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            {
                title: "reveal-code",
                handler: async notifiction => {
                    // Select the code
                    const startPosition = new vscode.Position(this.astNode.start.line - 1, this.astNode.start.column - 1);
                    const endPosition = new vscode.Position(this.astNode.end.line - 1, this.astNode.end.column - 1);
                    this.editor.selections = [new vscode.Selection(startPosition, endPosition)];

                    // If the selected range is not visible, scroll to the selection
                    this.editor.revealRange(
                        new vscode.Range(startPosition, endPosition),
                        vscode.TextEditorRevealType.InCenterIfOutsideViewport
                    );
                }
            }
        ];
    }

    protected createContentAttributes(): Record<string, string> {
        return {
            "class": "visualisation",
            "data-name": this.visualisationName,
            "data-id": this.id.toString(),
            "data-source-index": this.sourceIndex.toString()
        };
    }

    protected requestNewParsing(): void {
        this.ilatex.onVisualisationParsingRequest();
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

    protected renderContentAttributesAsHTML(): string {
        const contentAttributes = this.createContentAttributes();
        return Object.entries(contentAttributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");
    }

    protected abstract renderContentAsHTML(): string;

    createViewContent(): string {
        return `
            <div ${this.renderContentAttributesAsHTML()}>
                ${this.renderContentAsHTML()}
            </div>
        `;
    }
}