import { VisModel } from "../../../core/visualisations/VisModel";
import { Visualisation } from "../../../core/visualisations/Visualisation";
import { ASTNode, ASTNodeType, ASTNodeValue } from "../../../core/ast/LatexASTNode";

export class Model implements VisModel {
    provideModel(): Visualisation<ASTNode<ASTNodeType, ASTNodeValue>> {
        throw new Error("Vis B not implemented.");
    }
}