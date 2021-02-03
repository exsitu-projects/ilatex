import * as vscode from "vscode";
import * as P from "parsimmon";
import { SourceFile } from "../mappings/SourceFile";
import { SourceFileChange } from "../mappings/SourceFileChange";
import { ASTParser } from "./ASTParser";
import { ASTNode } from "./nodes/ASTNode";
import { LatexNode } from "./nodes/LatexNode";
import { ASTNodeCollecter } from "./visitors/ASTNodeCollecter";
import { ASTVisitor } from "./visitors/ASTVisitor";


/** Type of the root node of an AST. */
export type ASTRootNode = LatexNode;


export class NoASTRootNodeError {}


/** Class of an AST for a simple subset of Latex. */
export class LatexAST {
    private sourceFile: SourceFile;

    private rootNode: ASTRootNode | null;
    private allNodesCached: ASTNode[] | null;

    private rootNodeObserverDisposable: vscode.Disposable | null;
    
    constructor(sourceFile: SourceFile) {
        this.sourceFile = sourceFile;

        this.rootNode = null;
        this.allNodesCached = null;

        this.rootNodeObserverDisposable = null;
    }

    get hasRoot(): boolean {
        return !!this.rootNode;
    }

    get root(): ASTRootNode {
        if (!this.rootNode) {
            throw new NoASTRootNodeError();
        }

        return this.rootNode;
    }

    // TODO: handle cache issues when nodes are modified deep down in the tree
    get nodes(): ASTNode[] {
        // Either use the cached list of all nodes if it has already been computed,
        // or compute the list and cache it first (asussming there is a root node)
        if (!this.allNodesCached) {
            const nodeCollecter = new ASTNodeCollecter();
            this.root.visitWith(nodeCollecter);
            this.allNodesCached = nodeCollecter.nodes;
        }

        return this.allNodesCached;
    }

    async init(): Promise<void> {
        const parser = new ASTParser(this.sourceFile);
        this.rootNode = await parser.parse();
    }

    processSourceFileEdit(change: SourceFileChange): void {
        for (let node of this.nodes) {
            node.processSourceFileEdit(change);
        }
    }

    protected startObservingRootNode(): void {
        // Observe reparsing completions (both for successes and failures)
        this.rootNodeObserverDisposable = this.root.reparsingEndEventEmitter.event(({node, result}) => {
            if (result.status) {
                // TODO: Update the node
                console.info("The reparsing of root node of the AST suceeded: the root node must be changed!", result);
            }
            else {
                // TODO: re-parse the whole AST/handle the parsing error
                console.error("The reparsing of root node of the AST failed!", result);
            }
        });
    }

    protected stopObservingChildNode(): void {
        this.rootNodeObserverDisposable?.dispose();
    }

    visitWith(visitor: ASTVisitor, maxDepth: number = Number.MAX_SAFE_INTEGER): void {
        this.root.visitWith(visitor, 0, maxDepth);
    }
}