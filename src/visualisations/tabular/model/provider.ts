import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { VisualisationModelProvider, VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { TabularVisualisationModel } from "./model";


export class TabularVisualisationModelProvider implements VisualisationModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "tabular";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "itabular";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: VisualisationModelUtilities
    ): TabularVisualisationModel {
        return new TabularVisualisationModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

