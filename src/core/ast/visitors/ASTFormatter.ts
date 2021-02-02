import { ASTVisitor } from "./ASTVisitor";
import { ASTNode } from "../nodes/ASTNode";
import { ParameterNode } from "../nodes/ParameterNode";
import { ParameterValueNode } from "../nodes/ParameterValueNode";
import { ParameterAssignmentNode } from "../nodes/ParameterAssignmentNode";
import { ASTVisitorAdapter } from "./ASTVisitorAdapter";


 
export class ASTFormatter implements ASTVisitor {
    prefix: string ;
    indent: number;

    private formattedStrings: string[];

    constructor() {
        this.prefix = "| ";
        this.indent = 2;

        this.formattedStrings = [];
    }

    get formattedAST() {
        return this.formattedStrings.join("\n");
    }

    reset(): void {
        this.formattedStrings = [];
    }

    private createPadding(depth: number): string {
        return " ".repeat(this.indent * depth);
    }

    visit(node: ASTNode, depth: number): void {
        const padding = this.createPadding(depth);
        this.formattedStrings.push(
            `${padding}${this.prefix}${node.toString()}`
        );
    }
}