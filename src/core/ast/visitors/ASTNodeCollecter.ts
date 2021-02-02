import { ASTNode } from "../nodes/ASTNode";
import { ASTVisitor } from "./ASTVisitor";

/** Visitor that builds a list of all the visited nodes. */
export class ASTNodeCollecter implements ASTVisitor {
    readonly nodes: ASTNode[];

    constructor() {
        this.nodes = [];
    }

    visit(node: ASTNode, depth: number): void {
        this.nodes.push(node);
    }
};