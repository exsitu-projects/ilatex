import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { TransitionalModelProvider, VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { TemplateTransitionalModel } from "./model";


export class TemplateTransitionalModelProvider implements TransitionalModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "TODO";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "TODO";
    }

    provideModelWith(
        context: VisualisableCodeContext,
        utilities: TransitionalModelUtilities
    ): TemplateTransitionalModel {
        return new TemplateTransitionalModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

