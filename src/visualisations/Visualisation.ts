import * as vscode from 'vscode';
import { ASTNode } from "../ast/LatexASTNode";
import { NotifyVisualisationMessage } from "../webview/WebviewMessage";
import { WebviewManager } from '../webview/WebviewManager';

export type VisualisationID = number;

export type WebviewNotificationHandler = (payload: any, visualisation: Visualisation) => void;
export interface WebviewNotificationHandlerSpecification {
    subject: string;
    handler: WebviewNotificationHandler;
}

export abstract class Visualisation<T extends ASTNode = ASTNode> {
    private static maximumId: VisualisationID = 1;
    private static currentSourceIndex: number = 1;

    abstract readonly name: string;

    readonly node: T;
    readonly id: number;
    readonly sourceIndex: number; // Index of the visualisation in the AST
    protected props: Record<string, string>;

    protected readonly editor: vscode.TextEditor;
    protected readonly webviewManager: WebviewManager;
    protected subjectsToWebviewNotificationHandlers: Map<string, WebviewNotificationHandler>;

    constructor(node: T, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        this.node = node;
        this.id = Visualisation.generateUniqueId();
        this.sourceIndex = Visualisation.nextSourceIndex();
        this.props = {};

        this.editor = editor;
        this.webviewManager = webviewManager;

        this.subjectsToWebviewNotificationHandlers = new Map();
        this.initWebviewNotificationHandlers();
    }

    protected initProps(): void {
        this.props = {
            ...this.props,

            "class": "visualisation",
            "data-id": this.id.toString(),
            "data-source-index": this.sourceIndex.toString(),
            "data-name": this.name
        };
    }

    protected getWebviewNotificationHandlerSpecifications(): WebviewNotificationHandlerSpecification[] {
        return [];
    }

    private initWebviewNotificationHandlers(): void {
        const specifications = this.getWebviewNotificationHandlerSpecifications();
        for (let specification of specifications) {
            this.subjectsToWebviewNotificationHandlers.set(
                specification.subject,
                specification.handler
            );
        }
    };

    protected renderPropsAsHTML(): string {
        return Object.keys(this.props)
            .map(key => `${key}="${this.props[key]}"`)
            .join("\n");
    }

    handleWebviewNotification(message: NotifyVisualisationMessage): void {
        const subject = message.subject;
        if (!this.subjectsToWebviewNotificationHandlers.has(subject)) {
            console.error(`iLatex's ${this.name} visualisation has no notification handler for subject: ${subject}`);
            return;
        }

        const handler = this.subjectsToWebviewNotificationHandlers.get(subject);
        handler!(message.payload, this);
    };

    protected abstract renderContentAsHTML(): string;

    renderAsHTML(): string {
        return `
            <div ${this.renderPropsAsHTML()}>
                ${this.renderContentAsHTML()}
            </div>
        `;
    }

    private static generateUniqueId(): VisualisationID {
        Visualisation.maximumId += 1;
        return Visualisation.maximumId;
    }

    private static nextSourceIndex(): number {
        Visualisation.currentSourceIndex += 1;
        return Visualisation.currentSourceIndex;
    }

    static resetSourceIndex(): void {
        Visualisation.currentSourceIndex = 0;
    }
}