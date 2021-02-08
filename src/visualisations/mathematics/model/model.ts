import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { WhitespaceNode } from "../../../core/ast/nodes/WhitespaceNode";

export class MathematicsModel extends AbstractVisualisationModel<EnvironmentNode> {
    readonly name = "mathematics";
    private trimmedMathCode: string | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: VisualisationModelUtilities) {
        super(context, utilities);
        this.trimmedMathCode = null;
    }

    protected get contentDataAsHtml(): string {
        return this.trimmedMathCode || "";
    }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "set-math-code",
                handler: async payload => {
                    const { trimmedMathCode } = payload;
                    await this.setNewMathCode(trimmedMathCode);
                }
            }
        ];
    }

    protected async updateContentData(): Promise<void> {
        try {
            this.trimmedMathCode = await this.astNode.body.textContent;
            this.contentUpdateEndEventEmitter.fire(true);
        }
        catch (error) {
            console.log(`The content data update of the visualisation with UID ${this.uid} (${this.name}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);

        }
    }

    private async setNewMathCode(trimmedMathCode: string): Promise<void> {
        const editor = await this.sourceFile.getOrOpenInEditor();

        // Find the first and the last non-whitespace AST nodes in the environement
        // and replace the code between the start of the first node and the end of the second one
        // If there is non (i.e. only whitespace or nothing), simply replace the whole content
        const environementBodyNodes = [...this.astNode.body.childNodes];
        const firstNonWhitespaceNode = environementBodyNodes
            .find(node => !(node instanceof WhitespaceNode));
        const lastNonWhitespaceNode = environementBodyNodes
            .reverse()
            .find(node => !(node instanceof WhitespaceNode));

        const rangeToEdit = (firstNonWhitespaceNode !== undefined && lastNonWhitespaceNode !== undefined)
            ? new vscode.Range(
                firstNonWhitespaceNode.range.from.asVscodePosition,
                lastNonWhitespaceNode.range.to.asVscodePosition
            )
            : new vscode.Range(
                this.astNode.body.range.from.asVscodePosition,
                this.astNode.body.range.to.asVscodePosition
            );

        await editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, trimmedMathCode);
        });
    }
}