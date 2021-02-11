import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { CommandNode } from "../../../core/ast/nodes/CommandNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { VisualisationModelProvider, VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { IncludegraphicsVisualisationModel } from "./model";


export class IncludegraphicsVisualisationModelProvider implements VisualisationModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "includegraphics";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof CommandNode
            && node.name === "iincludegraphics";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: VisualisationModelUtilities
    ): IncludegraphicsVisualisationModel {
        return new IncludegraphicsVisualisationModel(
            context as VisualisableCodeContext<CommandNode>,
            utilities
        );
    };
}

