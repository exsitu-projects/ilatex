import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTCommandNode, ASTNodeType } from "../../../core/ast/LatexASTNode";
import { InteractiveLaTeX } from "../../../core/InteractiveLaTeX";


class IncludegraphicsModel extends AbstractVisualisationModel<ASTCommandNode> {
    static readonly visualisationName = "includegraphics";
    readonly visualisationName = IncludegraphicsModel.visualisationName;

    constructor(node: ASTCommandNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor) {
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

export default class IncludegraphicsModelFactory implements VisualisationModelFactory {
    readonly visualisationName = IncludegraphicsModel.visualisationName;
    readonly codePatternMatcher = (node: ASTNode) => {
        return node.type === ASTNodeType.Command
            && node.name === "includegraphics";
    };

    createModel(node: ASTNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor): VisualisationModel {
        return new IncludegraphicsModel(node as ASTCommandNode, ilatex, editor);
    }
}