import * as vscode from "vscode";
import { SourceFile } from "../source-files/SourceFile";
import { SourceFileChange } from "../source-files/SourceFileChange";
import { ASTParser, ASTParsingError } from "./ASTParser";
import { ASTNode } from "./nodes/ASTNode";
import { LatexNode } from "./nodes/LatexNode";
import { ASTNodeCollecter } from "./visitors/ASTNodeCollecter";
import { ASTVisitor } from "./visitors/ASTVisitor";


/** Type of the root node of an AST. */
export type ASTRootNode = LatexNode;


export class NoRootNodeError {}


/** Class of an AST for a simple subset of Latex. */
export class LatexAST {
    private readonly parser: ASTParser;
    private readonly sourceFile: SourceFile;
    private rootNode: ASTRootNode | null;

    readonly parsingErrorEventEmitter: vscode.EventEmitter<ASTParsingError>;

    private rootNodeObserverDisposable: vscode.Disposable | null;
    
    constructor(sourceFile: SourceFile) {
        this.parser = new ASTParser(sourceFile);
        this.sourceFile = sourceFile;
        this.rootNode = null;

        this.parsingErrorEventEmitter = new vscode.EventEmitter();

        this.rootNodeObserverDisposable = null;
    }

    async init(): Promise<void> {
        await this.tryToParseNewRootNode();
    }

    get hasRoot(): boolean {
        return !!this.rootNode;
    }

    get root(): ASTRootNode {
        if (!this.rootNode) {
            throw new NoRootNodeError();
        }

        return this.rootNode;
    }

    get nodes(): ASTNode[] {
        const nodeCollecter = new ASTNodeCollecter();
        this.root.visitWith(nodeCollecter);
        return nodeCollecter.nodes;
    }

    private changeRootNode(newRootNode: ASTRootNode): void {
        this.stopObservingRootNode();
        this.rootNode = newRootNode;
        this.startObservingRootNode();
    }

    private async tryToParseNewRootNode(): Promise<void> {
        try {
            const newRootNode = await this.parser.parse();
            this.changeRootNode(newRootNode);
        }
        catch (parsingError) {
            console.error("The parsing of the entire AST failed:", parsingError);
            this.parsingErrorEventEmitter.fire(parsingError);
        }
    }

    protected startObservingRootNode(): void {
        // Observe reparsing completions (both for successes and failures)
        this.rootNodeObserverDisposable = this.root.reparsingEndEventEmitter.event(async ({node, result}) => {
            if (result.status) {
                // TODO: Update the node
                console.info("The reparsing of root node of the AST suceeded: the root node must be changed!", result);
            }
            else {
                await this.tryToParseNewRootNode();
            }
        });
    }

    protected stopObservingRootNode(): void {
        this.rootNodeObserverDisposable?.dispose();
    }

    processSourceFileChange(change: SourceFileChange): void {
        if (this.hasRoot) {
            this.root.dispatchSourceFileChange(change);
        }
    }

    visitWith(visitor: ASTVisitor, maxDepth: number = Number.MAX_SAFE_INTEGER): void {
        this.root.visitWith(visitor, 0, maxDepth);
    }
}