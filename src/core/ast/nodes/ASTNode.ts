import * as vscode from "vscode";
import * as P from "parsimmon";
import { SourceFileRange, RelativeRangePosition } from "../../source-files/SourceFileRange";
import { SourceFileChange } from "../../source-files/SourceFileChange";
import { SourceFile } from "../../source-files/SourceFile";
import { ASTAsyncVisitor, ASTSyncVisitor } from "../visitors/visitors";
import { AtomicSourceFileEditor, SourceFileEditProvider } from "../../source-files/AtomicSourceFileEditor";
import { edits } from "./ast-node-edits";


export type ASTNodeParser<T extends ASTNode> = (input: string, context: ASTNodeContext) => P.Result<T>;

export type ASTNodeUpdateResult = 
    | { success: true, newAstNode: ASTNode }
    | { success: false, error: P.Failure };

export interface ASTNodeContext {
    range: SourceFileRange,
    sourceFile: SourceFile
};


export abstract class ASTNode {
    readonly abstract type: string;
    protected abstract parser: ASTNodeParser<ASTNode>;
    protected readonly abstract isLeaf: boolean;

    readonly edits = {
        setTextContent: (newContent: string) =>
            edits.setTextContent(this, newContent),
        deleteTextContent: (trimSurroundingWhitespace: boolean = true) =>
            edits.deleteTextContent(this, trimSurroundingWhitespace),
    };

    readonly sourceFile: SourceFile;
    readonly range: SourceFileRange;

    enableReparsing: boolean;
    private temporarilyPreventReparsing: boolean;
    protected hasUnreparsedContentChanges: boolean;

    readonly rangeChangeEventEmitter: vscode.EventEmitter<void>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<ASTNodeUpdateResult>;

    constructor(
        context: ASTNodeContext
    ) {
        this.sourceFile = context.sourceFile;
        this.range = context.range;

        this.enableReparsing = false;
        this.temporarilyPreventReparsing = false;
        this.hasUnreparsedContentChanges = false;

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

    protected startTemporarilyPreventingReparsing(): void {
        this.temporarilyPreventReparsing = true;
        for (let node of this.childNodes) {
            node.startTemporarilyPreventingReparsing();
        }
    }

    protected stopTemporarilyPreventingReparsing(): void {
        this.temporarilyPreventReparsing = false;
        for (let node of this.childNodes) {
            node.stopTemporarilyPreventingReparsing();
        }
    }

    protected async preventReparsingDuring(action: () => Promise<void>, reparseAfter: boolean = false): Promise<void> {
        this.startTemporarilyPreventingReparsing();
        await action();
        this.stopTemporarilyPreventingReparsing();

        if (reparseAfter && this.canBeReparsed) {
            await this.reparseAndUpdate();
        }
    }

    async applyEditsWithoutReparsing(editor: AtomicSourceFileEditor): Promise<void>;
    async applyEditsWithoutReparsing(editProviders: SourceFileEditProvider[]): Promise<void>;
    async applyEditsWithoutReparsing(editorOrEditProviders: AtomicSourceFileEditor | SourceFileEditProvider[]): Promise<void> {
        const editor = Array.isArray(editorOrEditProviders)
            ? this.sourceFile.createAtomicEditor(editorOrEditProviders)
            : editorOrEditProviders;
        
        this.preventReparsingDuring(
            async () => { await editor.apply(); },
            true
        );
    }

    async setTextContent(newContent: string): Promise<void> {
        await this.applyEditsWithoutReparsing([
            this.edits.setTextContent(newContent)
        ]);
    }

    async deleteTextContent(trimSurroundingWhitespace: boolean = true): Promise<void> {
        await this.applyEditsWithoutReparsing([
            this.edits.deleteTextContent(trimSurroundingWhitespace)
        ]);
    }

    // async makeAtomicChangeWithinNode(edit: SourceFileEdit): Promise<void>;
    // async makeAtomicChangeWithinNode(edits: SourceFileEdit[]): Promise<void>;
    // async makeAtomicChangeWithinNode(editOrEdits: SourceFileEdit | SourceFileEdit[]): Promise<void> {
    //     // TODO: possibly check that all the given edits are indeed located within this node
    //     this.beginAtomicChange();
    //     await this.sourceFile.makeAtomicChange(editOrEdits);
    //     this.endAtomicChange();
    // }

    // Dispatch a source file change to this node + every of its children in the AST
    // Return a promiseresolving to a boolean indicating whether the node requires reparsing or not
    async dispatchAndProcessChange(change: SourceFileChange): Promise<boolean> {
        this.processChange(change);

        let someChildNodeRequiresReparsing = false;
        for (let node of this.childNodes) {
            someChildNodeRequiresReparsing = await node.dispatchAndProcessChange(change) || someChildNodeRequiresReparsing;
        }

        if (this.hasUnreparsedContentChanges || someChildNodeRequiresReparsing) {
            if (!this.temporarilyPreventReparsing && this.canBeReparsed) {
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

        else if (relativePositionToModifiedRange === RelativeRangePosition.Before) {
            this.rangeChangeEventEmitter.fire();
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