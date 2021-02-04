import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { VisualisationModel } from "./VisualisationModel";
import { VisualisationModelUtilities } from "./VisualisationModelUtilities";

/**
 * The context given to every visualisation model.
 * It includes the AST node that must be visualised,
 * the code mapping that generated this visualisation,
 * and the source file they both refer to.
 */
export interface VisualisableCodeContext<T extends ASTNode> {
    astNode: T;
    codeMapping: CodeMapping;
    sourceFile: SourceFile;
}

export interface VisualisationModelProvider {
    readonly canProvideForCodeMapping: (mapping: CodeMapping) => boolean;
    readonly canProvideForASTNode: (node: ASTNode) => boolean;

    provideModelWith<T extends ASTNode>(
        context: VisualisableCodeContext<T>,
        utilities: VisualisationModelUtilities
    ): VisualisationModel;
}