import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { VisualisationModelProvider, VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { MathematicsModel } from "./model";


export class MathematicsVisualisationModelProvider implements VisualisationModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "mathematics";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "imaths";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: VisualisationModelUtilities
    ): MathematicsModel {
        return new MathematicsModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

