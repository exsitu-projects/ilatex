
import { ASTNode } from "../nodes/ASTNode";
import { ASTSyncVisitorAdapter } from "./adapters";


export class ASTFormatter extends ASTSyncVisitorAdapter {
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

    protected visitNode(node: ASTNode, depth: number): void {
        const padding = this.createPadding(depth);
        this.formattedStrings.push(
            `${padding}${this.prefix}${node.toString()}`
        );
    }
}