import * as vscode from "vscode";
import { SourceFile } from "../source-files/SourceFile";
import { SourceFileChange } from "../source-files/SourceFileChange";
import { ASTParser, ASTParsingError } from "./ASTParser";
import { ASTNode } from "./nodes/ASTNode";
import { LatexNode } from "./nodes/LatexNode";
import { ASTFormatter } from "./visitors/ASTFormatter";
import { ASTNodeCollecter } from "./visitors/ASTNodeCollecter";
import { ASTSyncVisitor, ASTAsyncVisitor } from "./visitors/visitors";


/** Type of the root node of an AST. */
export type ASTRootNode = LatexNode;


export class NoRootNodeError {}


/** Class of an AST for a simple subset of Latex. */
export class LatexAST {
    private readonly parser: ASTParser;
    private readonly sourceFile: SourceFile;
    private rootNode: ASTRootNode | null;

    // readonly parsingErrorEventEmitter: vscode.EventEmitter<ASTParsingError>;

    private rootNodeObserverDisposable: vscode.Disposable | null;
    
    constructor(sourceFile: SourceFile) {
        this.parser = new ASTParser(sourceFile);
        this.sourceFile = sourceFile;
        this.rootNode = null;

        // this.parsingErrorEventEmitter = new vscode.EventEmitter();

        this.rootNodeObserverDisposable = null;
    }

    async init(): Promise<void> {
        await this.parseNewRoot();
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
        this.root.syncVisitWith(nodeCollecter);
        return nodeCollecter.nodes;
    }

    private changeRootNode(newRootNode: ASTRootNode): void {
        this.stopObservingRootNode();
        this.rootNode = newRootNode;
        this.startObservingRootNode();
    }

    async parseNewRoot(): Promise<boolean> {
        try {
            const newRootNode = await this.parser.parse();
            this.changeRootNode(newRootNode);

            // console.info(`Root AST node of ${this.sourceFile.name} changed:`);
            // const astFormatter = new ASTFormatter();
            // await this.syncVisitWith(astFormatter);
            // console.log(astFormatter.formattedAST);

            return true;
        }
        catch (parsingError) {
            console.warn(`The parsing of the AST of ${this.sourceFile.name} failed:`, parsingError);
            // this.parsingErrorEventEmitter.fire(parsingError);

            return false;
        }
    }

    protected startObservingRootNode(): void {
        // // Observe reparsing completions (both for successes and failures)
        // this.rootNodeObserverDisposable = this.root.reparsingEndEventEmitter.event(async ({node, result}) => {
        //     if (result.status) {
        //         console.info("The reparsing of root node of the AST suceeded: the root node should be changed.");
        //     }
        //     else {
        //         await this.tryToParseNewRootNode();
        //     }
        // });
    }

    protected stopObservingRootNode(): void {
        // this.rootNodeObserverDisposable?.dispose();
    }

    async processSourceFileChange(change: SourceFileChange): Promise<void> {
        if (this.hasRoot) {
            await this.root.dispatchAndProcessChange(change);
        }
    }

    async syncVisitWith(visitor: ASTSyncVisitor, maxDepth: number = Number.MAX_SAFE_INTEGER): Promise<void> {
        this.root.syncVisitWith(visitor, 0, maxDepth);
    }

    async asyncVisitWith(visitor: ASTAsyncVisitor, maxDepth: number = Number.MAX_SAFE_INTEGER): Promise<void> {
        await this.root.asyncVisitWith(visitor, 0, maxDepth);
    }
}