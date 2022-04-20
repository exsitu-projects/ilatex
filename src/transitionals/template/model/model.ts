import * as vscode from "vscode";
import { TransitionalModel, ViewMessageHandlerSpecification } from "../../../core/transitionals/TransitionalModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";

export class TemplateTransitionalModel extends TransitionalModel<EnvironmentNode> {
    // This property must contain the name of the transitioal this model is designed for.
    // It must correspond to the name used in the view.
    readonly transitionalName = "TODO";

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: TransitionalModelUtilities) {
        super(context, utilities);
    }

    // This method must return a string containing the content to send to the view of this transitional,
    // serialised as a valid piece of HTML (since it will be parsed as is in the webview).
    protected get contentDataAsHtml(): string {
        throw new Error("Method not implemented.");
    }

    // This method must return an array of view message handlers.
    // It should extend the array returned by `super.viewMessageHandlerSpecifications`.
    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "message-title",
                handler: async payload => {
                    throw new Error("Not implemented.");
                }
            },
        ];
    }

    // This method must update the content of this transitional model, i.e. what it extracts from the AST node it is given.
    // In particular, it is called every time the AST node is modified.
    protected async updateContentData(): Promise<void> {
        try {
            throw new Error("Not implemented.");
            this.contentUpdateEndEventEmitter.fire(true);
        }
        catch (error) {
            console.log(`The content data update of the transitional with UID ${this.uid} (${this.transitionalName}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);

        }
    }
}