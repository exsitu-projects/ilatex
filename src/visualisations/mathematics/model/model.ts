import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel, VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTEnvironementNode, ASTNodeType } from "../../../core/ast/LatexASTNode";
import { CodeMapping } from "../../../core/mappings/CodeMapping";


class MathematicsModel extends AbstractVisualisationModel<ASTEnvironementNode> {
    static readonly visualisationName = "mathematics";
    readonly visualisationName = MathematicsModel.visualisationName;

    constructor(node: ASTEnvironementNode, mapping: CodeMapping, utilities: VisualisationModelUtilities) {
        super(node, mapping, utilities);
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            ...super.createNotificationHandlerSpecifications(),

            {
                title: "set-math-code",
                handler: async payload => {
                    const { trimmedMathCode } = payload;
                    await this.setNewMathCode(trimmedMathCode);
                }
            }
        ];
    }

    private async setNewMathCode(trimmedMathCode: string): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();

        // Find the first and the last non-whitespace AST nodes in the environement
        // and replace the code between the start of the first node and the end of the second one
        // If there is non (i.e. only whitespace or nothing), simply replace the whole content
        const environementContentNodes = this.astNode.value.content.value as ASTNode[];
        const firstNonWhitespaceNode = environementContentNodes.find(node => node.type !== ASTNodeType.Whitespace);
        const lastNonWhitespaceNode = [...environementContentNodes] // Clone the array because .reverse() is performed in-place
            .reverse()
            .find(node => node.type !== ASTNodeType.Whitespace);

        const editRangePositions = (firstNonWhitespaceNode !== undefined && lastNonWhitespaceNode !== undefined)
            ? { start: firstNonWhitespaceNode.start, end: lastNonWhitespaceNode.end }
            : { start: this.astNode.value.content.start, end: this.astNode.value.content.end };
        
        const rangeToEdit = new vscode.Range(
            new vscode.Position(editRangePositions.start.line - 1, editRangePositions.start.column - 1),
            new vscode.Position(editRangePositions.end.line - 1, editRangePositions.end.column - 1)
        );

        await editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, trimmedMathCode);
        });
    }

    protected renderContentAsHTML(): string {
        const fileContent = this.codeMapping.sourceFile.readContentSync();
        const mathsAsText = fileContent.substring(
            this.astNode.value.content.start.offset,
            this.astNode.value.content.end.offset
        );

        return mathsAsText;

        // const mathsAsKatexHtml = katex.renderToString(mathsAsText, {
        //     throwOnError: false
        // });

        // return mathsAsKatexHtml;
    }
}

export class MathematicsModelFactory implements VisualisationModelFactory {
    readonly visualisationName = MathematicsModel.visualisationName;
    readonly astMatchingRule = (node: ASTNode) => {
        return node.type === ASTNodeType.Environement
            && node.name === "imaths";
    };

    createModel(node: ASTNode, mapping: CodeMapping, utilities: VisualisationModelUtilities): VisualisationModel {
        return new MathematicsModel(node as ASTEnvironementNode, mapping, utilities);
    }
}