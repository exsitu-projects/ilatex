import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { VisualisationModelProvider, VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { GridLayoutModel } from "./model";

export class GridLayoutVisualisationModelProvider implements VisualisationModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "gridlayout";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "gridlayout";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: VisualisationModelUtilities
    ): GridLayoutModel {
        return new GridLayoutModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

