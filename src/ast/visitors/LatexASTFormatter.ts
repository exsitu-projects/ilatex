import { ASTParameterAssigmentNode, ASTParameterNode } from "../LatexASTNode";
import { LatexASTVisitorAdapter } from "./LatexASTVisitorAdapter";

 
export class LatexASTFormatter extends LatexASTVisitorAdapter {
    static prefix = "| ";
    static indent = 4;

    private formattedStrings: string[];

    constructor() {
        super();
        this.formattedStrings = [];
    }

    get formattedAST() {
        return this.formattedStrings.join("\n");
    }

    reset(): void {
        this.formattedStrings = [];
    }

    protected visitNode(node: ASTParameterNode, depth: number): void {
        const padding = LatexASTFormatter.createPadding(depth);
        const str = node.name.length > 0
                  ? `${padding}${LatexASTFormatter.prefix}${node.type} [${node.name}]`
                  : `${padding}${LatexASTFormatter.prefix}${node.type}`;

        this.formattedStrings.push(str);
    }

    protected visitParameterNode(node: ASTParameterNode, depth: number): void {
        const padding = LatexASTFormatter.createPadding(depth);
        const str = `${padding}${LatexASTFormatter.prefix}${node.type} [${node.value}]`;

        this.formattedStrings.push(str);
    }

    protected visitParameterAssigmentNode(node: ASTParameterAssigmentNode, depth: number): void {
        const padding = LatexASTFormatter.createPadding(depth);
        const str = `${padding}${LatexASTFormatter.prefix}${node.type} [${node.value.key.value} = ${node.value.value.value}]`;

        this.formattedStrings.push(str);
    }

    static createPadding(depth: number): string {
        return " ".repeat(LatexASTFormatter.indent * depth);
    }
}