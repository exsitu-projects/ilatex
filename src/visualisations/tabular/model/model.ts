import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTEnvironementNode, ASTNodeType } from "../../../core/ast/LatexASTNode";
import { InteractiveLaTeX } from "../../../core/InteractiveLaTeX";


class TabularModel extends AbstractVisualisationModel<ASTEnvironementNode> {
    static readonly visualisationName = "tabular";
    readonly visualisationName = TabularModel.visualisationName;

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

export default class TabularModelFactory implements VisualisationModelFactory {
    readonly visualisationName = TabularModel.visualisationName;
    readonly codePatternMatcher = (node: ASTNode) => {
        return node.type === ASTNodeType.Environement
            && node.name === "tabular";
    };

    createModel(node: ASTNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor): VisualisationModel {
        return new TabularModel(node as ASTEnvironementNode, ilatex, editor);
    }
}