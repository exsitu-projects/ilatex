import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { TransitionalModelProvider, VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { GridLayoutTransitionalModel } from "./GridLayoutTransitionalModel";

export class GridLayoutTransitionalModelProvider implements TransitionalModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "gridlayout";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "gridlayout";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: TransitionalModelUtilities
    ): GridLayoutTransitionalModel {
        return new GridLayoutTransitionalModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

