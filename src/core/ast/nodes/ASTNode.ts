import * as vscode from "vscode";
import * as P from "parsimmon";
import { RangeInFile, RelativeRangePosition } from "../../utils/RangeInFile";
import { SourceFileChange } from "../../source-files/SourceFileChange";
import { SourceFile, SourceFileEdit } from "../../source-files/SourceFile";
import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { ASTAsyncVisitor, ASTSyncVisitor } from "../visitors/visitors";
import { BlockNode } from "./BlockNode";


export type ASTNodeParser<T extends ASTNode> = (input: string, context: ASTNodeContext) => P.Result<T>;

export type ASTNodeUpdateResult = 
    | { success: true, newAstNode: ASTNode }
    | { success: false, error: P.Failure };

export interface ASTNodeContext {
    range: RangeInFile,
    sourceFile: SourceFile
};


export abstract class ASTNode {
    readonly abstract type: string;
    protected abstract parser: ASTNodeParser<ASTNode>;
    readonly sourceFile: SourceFile;
    readonly range: RangeInFile;
    protected readonly abstract isLeaf: boolean;

    enableReparsing: boolean;
    protected hasUnreparsedContentChanges: boolean;
    private isPartOfAtomicChange: boolean;

    readonly rangeChangeEventEmitter: vscode.EventEmitter<void>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<ASTNodeUpdateResult>;

    constructor(
        context: ASTNodeContext
    ) {
        this.sourceFile = context.sourceFile;
        this.range = context.range;

        this.enableReparsing = false;
        this.hasUnreparsedContentChanges = false;
        this.isPartOfAtomicChange = false;

        this.rangeChangeEventEmitter = new vscode.EventEmitter();
        this.contentChangeEventEmitter = new vscode.EventEmitter();
    }

    get textContent(): Promise<string> {
        return this.sourceFile.getContent(this.range);
    }

    get canBeReparsed(): boolean {
        return this.enableReparsing;
    }

    get requiresReparsing(): boolean {
        return this.hasUnreparsedContentChanges;
    }

    abstract get childNodes(): ASTNode[];

    async selectRangeInEditor(): Promise<void> {
        await this.sourceFile.selectRangeInEditor(this.range);
    }

    protected async beginAtomicChange(): Promise<void> {
        this.isPartOfAtomicChange = true;
        for (let node of this.childNodes) {
            node.beginAtomicChange();
        }
    }

    protected async endAtomicChange(): Promise<void> {
        this.isPartOfAtomicChange = false;
        for (let node of this.childNodes) {
            node.endAtomicChange();
        }

        if (this.canBeReparsed) {
            await this.reparseAndUpdate();
        }
    }

    async makeAtomicChangeWithinNode(edit: SourceFileEdit): Promise<void>;
    async makeAtomicChangeWithinNode(edits: SourceFileEdit[]): Promise<void>;
    async makeAtomicChangeWithinNode(editOrEdits: SourceFileEdit | SourceFileEdit[]): Promise<void> {
        // TODO: possibly check that all the given edits are indeed located within this node
        this.beginAtomicChange();
        await this.sourceFile.makeAtomicChange(editOrEdits);
        this.endAtomicChange();
    }

    async setTextContent(newContent: string): Promise<void> {
        await this.makeAtomicChangeWithinNode(editBuilder => {
            editBuilder.replace(this.range.asVscodeRange, newContent);
        });
    }

    // Dispatch a source file change to this node + every of its children in the AST
    // Return a promiseresolving to a boolean indicating whether the node requires reparsing or not
    async dispatchAndProcessChange(change: SourceFileChange): Promise<boolean> {
        this.processChange(change);

        let someChildNodeRequiresReparsing = false;
        for (let node of this.childNodes) {
            someChildNodeRequiresReparsing = await node.dispatchAndProcessChange(change) || someChildNodeRequiresReparsing;
        }

        if (this.hasUnreparsedContentChanges || someChildNodeRequiresReparsing) {
            if (!this.isPartOfAtomicChange && this.canBeReparsed) {
                await this.reparseAndUpdate();
                return this.hasUnreparsedContentChanges;
            }

            return true;
        }
        
        return false;
    }

    private processChange(change: SourceFileChange): void {
        const relativePositionToModifiedRange = this.range.processChange(change);

        if (relativePositionToModifiedRange === RelativeRangePosition.Across
        || (this.isLeaf && relativePositionToModifiedRange === RelativeRangePosition.Within)) {
            // console.log(`${this.toString()} requires reparsing`);
            this.hasUnreparsedContentChanges = true;
        }
    }

    protected async reparse(): Promise<P.Result<ASTNode>> {
        // console.info("About to re-parse AST node:", this);
        const result = this.parser(await this.textContent, {
            sourceFile: this.sourceFile,
            range: this.range
        });

        // console.log("Re-parsing result:", result);
        return result;
    }

    protected async updateWith(reparsedNode: ASTNode): Promise<void> {
        // This method must be overriden by every AST node
        // that contains content (text, child nodes...)
    };

    protected async reparseAndUpdate(): Promise<void> {
        const result = await this.reparse();

        if (result.status) {
            const newNode = result.value;

            await this.updateWith(newNode);
            this.hasUnreparsedContentChanges = false;

            this.contentChangeEventEmitter.fire({ success: true, newAstNode: newNode });
            console.info(`✅ Reparsing of "${this.toString()}" node was successful.`);
        }
        else {
            this.hasUnreparsedContentChanges = true;

            this.contentChangeEventEmitter.fire({ success: false, error: result });
            console.warn(`❌ Reparsing of "${this.toString()}" node was a failure.`);
            console.warn("The reparser reported an error:", result);
        }
    }

    protected abstract syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number): void;
    protected abstract asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number): Promise<void>;

    syncVisitWith(
        visitor: ASTSyncVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ): void {
        if (depth > maxDepth) {
            return;
        }
        
        this.syncSelfVisitWith(visitor, depth);
        for (let node of this.childNodes) {
            node.syncVisitWith(visitor, depth + 1, maxDepth);
        }
    }

    async asyncVisitWith(
        visitor: ASTAsyncVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ): Promise<void> {
        if (depth > maxDepth) {
            return;
        }
        
        await this.asyncSelfVisitWith(visitor, depth);
        for (let node of this.childNodes) {
            await node.asyncVisitWith(visitor, depth + 1, maxDepth);
        }
    }
}