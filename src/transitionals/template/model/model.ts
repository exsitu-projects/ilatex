import * as vscode from "vscode";
import { TransitionalModel, ViewMessageHandlerSpecification } from "../../../core/transitionals/TransitionalModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";

export class TemplateTransitionalModel extends TransitionalModel<EnvironmentNode> {
    readonly name = "TODO";

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: TransitionalModelUtilities) {
        super(context, utilities);
    }

    protected get contentDataAsHtml(): string {
        throw new Error("Method not implemented.");
    }

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

    protected async updateContentData(): Promise<void> {
        try {
            throw new Error("Not implemented.");
            this.contentUpdateEndEventEmitter.fire(true);
        }
        catch (error) {
            console.log(`The content data update of the transitional with UID ${this.uid} (${this.name}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);

        }
    }
}