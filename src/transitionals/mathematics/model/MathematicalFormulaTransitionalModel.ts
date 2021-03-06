import * as vscode from "vscode";
import { TransitionalModel, ViewMessageHandlerSpecification } from "../../../core/transitionals/TransitionalModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { WhitespaceNode } from "../../../core/ast/nodes/WhitespaceNode";
import { ArrayUtils } from "../../../shared/utils/ArrayUtils";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";

export class MathematicalFormulaTransitionalModel extends TransitionalModel<EnvironmentNode> {
    readonly transitionalName = "mathematics";
    private trimmedMathCode: string | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: TransitionalModelUtilities) {
        super(context, utilities);
        this.trimmedMathCode = null;
    }

    private get mathCode(): Promise<string> {
        return this.astNode.body.textContent;
    }

    protected get contentDataAsHtml(): string {
        return this.trimmedMathCode || "";
    }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "hover-math-region",
                handler: async payload => {
                    this.logEvent("math-region-hovered");
                }
            },
            {
                title: "select-math-region",
                handler: async payload => {
                    this.logEvent("math-region-selected");
                }
            },
            {
                title: "set-math-code",
                handler: async payload => {
                    const { trimmedMathCode } = payload;

                    // If the new code is the same than the old code (trimmed), do nothing
                    const isSameCode = await this.isTrimmedMathCodeEqualTo(trimmedMathCode);
                    if (isSameCode) {
                        return;
                    }

                    await this.setNewMathCode(trimmedMathCode);
                    this.registerChangeRequestedByTheView();

                    this.logEvent("set-new-math-code");
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
            console.log(`The content data update of the transitional with UID ${this.uid} (${this.transitionalName}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);

        }
    }

    private async isTrimmedMathCodeEqualTo(otherTrimmedMathCode: string): Promise<boolean> {
        const trimmedMathCode = (await this.mathCode).trim();
        return trimmedMathCode === otherTrimmedMathCode;
    }

    private async setNewMathCode(trimmedMathCode: string): Promise<void> {
        // Find the first and the last non-whitespace AST nodes in the environement
        // and replace the code between the start of the first node and the end of the second one
        // If there is none (i.e. only whitespace or nothing), simply replace the whole content
        const environementBodyNodes = [...this.astNode.body.childNodes];
        const firstNonWhitespaceNode = ArrayUtils.firstMatch(environementBodyNodes, node => !(node instanceof WhitespaceNode));
        const lastNonWhitespaceNode = ArrayUtils.lastMatch(environementBodyNodes, node => !(node instanceof WhitespaceNode));

        let rangeToEdit = this.astNode.body.range;
        if (firstNonWhitespaceNode.success && lastNonWhitespaceNode.success) {
            rangeToEdit = new SourceFileRange(
                firstNonWhitespaceNode.element.range.from,
                lastNonWhitespaceNode.element.range.to
            );
        }

        const editor = this.sourceFile.createEditor();
        editor.replace(rangeToEdit, trimmedMathCode);
        
        await this.astNode.applyEditsWithoutReparsing(editor);
    }
}