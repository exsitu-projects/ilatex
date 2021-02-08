import { ASTNode } from "../nodes/ASTNode";
import { ASTSyncVisitorAdapter } from "./adapters";

/** Visitor that builds a list of all the visited nodes. */
export class ASTNodeCollecter extends ASTSyncVisitorAdapter {
    readonly nodes: ASTNode[];

    constructor() {
        super();
        this.nodes = [];
    }

    protected async visitNode(node: ASTNode, depth: number): Promise<void> {
        this.nodes.push(node);
    }
};