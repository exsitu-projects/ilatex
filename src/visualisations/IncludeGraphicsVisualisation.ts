import { Visualisation } from "./Visualisation";
import { ASTCommandNode, ASTParameterNode, ASTParameterAssigmentsNode } from "../ast/LatexASTNode";

interface Graphics {
    path: string;
    options: {
        width?: string;
        height?: string;
    };
}

export class IncludeGraphicsVisualisation implements Visualisation {
    private node: ASTCommandNode;
    private graphics: Graphics;
    
    constructor(node: ASTCommandNode) {
        this.node = node;
        this.graphics = {
            path: "",
            options: {}
        };

        this.extractGraphics();
    }

    // TODO: refactor by allowing visitors to visit any AST subtree
    private extractGraphics(): void {
        // Extract the options, if any
        const hasOptionNode = this.node.value.parameters[0].length === 1;
        if (hasOptionNode) {
            //console.log("has option node");
            //console.log(this.node.value.parameters);
            const optionNode = this.node.value.parameters[0][0] as ASTParameterAssigmentsNode;

            for (let paramAssignmentNode of optionNode.value) {
                const possibleKeys = ["width", "height"];
                const key = paramAssignmentNode.value.key.value.trim();
                if (possibleKeys.includes(key)) {
                    const value = paramAssignmentNode.value.value.value.trim();
                    (this.graphics.options as any)[key] = value;
                }
            }
        }

        // Extract the path
        const pathParametetIndex = hasOptionNode ? 1 : 0;
        const pathParameter = this.node.value.parameters[pathParametetIndex][0] as ASTParameterNode;
        this.graphics.path = pathParameter.value;
    }
    
    renderAsHTML(): string {
        return `
            <div class="ilatex-includegraphics">
                <img src="${this.graphics.path}">
            </div>
        `;
    }
}