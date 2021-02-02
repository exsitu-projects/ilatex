import { ASTVisitorAdapter } from "./ASTVisitorAdapter";
import { ASTNode } from "../nodes/ASTNode";


export class ASTFormatter extends ASTVisitorAdapter {
    prefix: string ;
    indent: number;

    private formattedStrings: string[];

    constructor() {
        super();

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