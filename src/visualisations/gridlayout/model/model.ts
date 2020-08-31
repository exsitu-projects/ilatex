import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTEnvironementNode, ASTNodeType } from "../../../core/ast/LatexASTNode";
import { InteractiveLaTeX } from "../../../core/InteractiveLaTeX";


class GridLayoutModel extends AbstractVisualisationModel<ASTEnvironementNode> {
    static readonly visualisationName = "gridlayout";
    readonly visualisationName = GridLayoutModel.visualisationName;

    constructor(node: ASTEnvironementNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor) {
        super(node, ilatex, editor);
    }

    protected createContentAttributes(): Record<string, string> {
        return {
            ...super.createContentAttributes(),

            // TODO
        };
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            ...super.createNotificationHandlerSpecifications(),

            // TODO
        ];
    }

    protected renderContentAsHTML(): string {
        return "";

        // TODO
    }
}

export default class GridLayoutModelFactory implements VisualisationModelFactory {
    readonly visualisationName = GridLayoutModel.visualisationName;
    readonly codePatternMatcher = (node: ASTNode) => {
        return node.type === ASTNodeType.Environement
            && node.name === "gridlayout";
    };

    createModel(node: ASTNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor): VisualisationModel {
        return new GridLayoutModel(node as ASTEnvironementNode, ilatex, editor);
    }
}