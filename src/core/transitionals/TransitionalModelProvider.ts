import { ASTNode } from "../ast/nodes/ASTNode";
import { CodeMapping } from "../code-mappings/CodeMapping";
import { SourceFile } from "../source-files/SourceFile";
import { TransitionalModel } from "./TransitionalModel";
import { TransitionalModelUtilities } from "./TransitionalModelUtilities";

/**
 * The context given to every transitional model.
 * It includes the AST node that must be represented,
 * the code mapping that generated this transitional,
 * and the source file they both refer to.
 */
export interface VisualisableCodeContext<T extends ASTNode = ASTNode> {
    astNode: T;
    codeMapping: CodeMapping;
    sourceFile: SourceFile;
}

export interface TransitionalModelProvider {
    canProvideForCodeMapping(mapping: CodeMapping): boolean;
    canProvideForASTNode(node: ASTNode): boolean;

    provideModelWith<T extends ASTNode>(
        context: VisualisableCodeContext<T>,
        utilities: TransitionalModelUtilities
    ): TransitionalModel;
}