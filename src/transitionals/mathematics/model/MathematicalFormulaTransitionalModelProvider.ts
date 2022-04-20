import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { TransitionalModelProvider, VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { MathematicalFormulaTransitionalModel } from "./MathematicalFormulaTransitionalModel";


export class MathematicalFormulaTransitionalModelProvider implements TransitionalModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "mathematics";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof EnvironmentNode
            && node.name === "imaths";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: TransitionalModelUtilities
    ): MathematicalFormulaTransitionalModel {
        return new MathematicalFormulaTransitionalModel(
            context as VisualisableCodeContext<EnvironmentNode>,
            utilities
        );
    };
}

