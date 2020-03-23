import { ASTNode, ASTParameterAssigmentNode, ASTEnvironementNode, ASTNodeType, ASTCommandNode } from "./LatexASTNode";
import { LatexASTVisitor } from "./LatexASTVisitor";

 
export class LatexASTFormatter extends LatexASTVisitor {
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

    private addFormattedString(node: ASTNode, depth: number): void {
        console.log(node);

        const padding = LatexASTFormatter.createPadding(depth);
        const str = node.name.length > 0
                  ? `${padding}${LatexASTFormatter.prefix}${node.type} [${node.name}]`
                  : `${padding}${LatexASTFormatter.prefix}${node.type}`;

        this.formattedStrings.push(str);
    }

    protected visitParameterAssigmentNode(node: ASTParameterAssigmentNode, depth: number) {
        const padding = LatexASTFormatter.createPadding(depth);
        const str = `${padding}${LatexASTFormatter.prefix}${node.type} [${node.value.key.value} = ${node.value.value.value}]`;

        this.formattedStrings.push(str);
    }

    visit(node: ASTNode, depth: number): void {
        if (node.type === ASTNodeType.ParameterAssigment) {
            this.visitParameterAssigmentNode(node as ASTParameterAssigmentNode, depth);
        }
        else {
            this.addFormattedString(node, depth);
        }

        //super.visit(node, depth);
    }

    reset(): void {
        this.formattedStrings = [];
    }

    static createPadding(depth: number): string {
        return " ".repeat(LatexASTFormatter.indent * depth);
    }
}