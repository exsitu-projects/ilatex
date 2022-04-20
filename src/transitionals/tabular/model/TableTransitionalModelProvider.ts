import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { TransitionalModelProvider, VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { TableTransitionalModel } from "./TableTransitionalModel";


export class TableTransitionalModelProvider implements TransitionalModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "tabular";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "itabular";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: TransitionalModelUtilities
    ): TableTransitionalModel {
        return new TableTransitionalModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

