import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { CommandNode } from "../../../core/ast/nodes/CommandNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { TransitionalModelProvider, VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { ImageTransitionalModel } from "./ImageTransitionalModel";


export class ImageTransitionalModelProvider implements TransitionalModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean {
        return mapping.type === "includegraphics";
    }

    canProvideForASTNode(node: ASTNode): boolean {
        return node instanceof CommandNode
            && node.name === "iincludegraphics";
    }

    provideModelWith(
        context: VisualisableCodeContext<ASTNode>,
        utilities: TransitionalModelUtilities
    ): ImageTransitionalModel {
        return new ImageTransitionalModel(
            context as VisualisableCodeContext<CommandNode>,
            utilities
        );
    };
}

