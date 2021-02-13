import * as vscode from "vscode";
import * as P from "parsimmon";
import { RangeInFile, RelativeRangePosition } from "../../utils/RangeInFile";
import { SourceFileChange } from "../../source-files/SourceFileChange";
import { SourceFile, SourceFileEdit } from "../../source-files/SourceFile";
import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { ASTAsyncVisitor, ASTSyncVisitor } from "../visitors/visitors";
import { BlockNode } from "./BlockNode";


export type ASTNodeParser<T extends ASTNode> = (input: string, context: ASTNodeContext) => P.Result<T>;


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

    private isPartOfAtomicChange: boolean;
    mustReparseChildNodesOutOfSyncAfterChange: boolean;
    protected requiresReparsing: boolean;
    private reparsingError: P.Failure | null;

    readonly rangeChangeEventEmitter: vscode.EventEmitter<void>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<void>; // TODO: remove?
    readonly beforeNodeUpdateEventEmitter: vscode.EventEmitter<{ newNode: ASTNode }>;

    constructor(
        context: ASTNodeContext
    ) {
        this.sourceFile = context.sourceFile;
        this.range = context.range;

        this.isPartOfAtomicChange = false;
        this.mustReparseChildNodesOutOfSyncAfterChange = false;
        this.requiresReparsing = false;
        this.reparsingError = null;

        this.rangeChangeEventEmitter = new vscode.EventEmitter();
        this.contentChangeEventEmitter = new vscode.EventEmitter();
        this.beforeNodeUpdateEventEmitter = new vscode.EventEmitter();
    }

    get textContent(): Promise<string> {
        return this.sourceFile.getContent(this.range);
    }

    abstract get childNodes(): ASTNode[];

    async selectRangeInEditor(): Promise<void> {
        await this.sourceFile.selectRangeInEditor(this.range);
    }

    protected beginAtomicChange(): void {
        this.isPartOfAtomicChange = true;
        for (let node of this.childNodes) {
            node.beginAtomicChange();
        }
    }

    protected endAtomicChange(emitChangeEvent: boolean = false): void {
        this.isPartOfAtomicChange = false;
        for (let node of this.childNodes) {
            node.endAtomicChange();
        }

        if (emitChangeEvent) {
            this.contentChangeEventEmitter.fire();
        }
    }

    async makeAtomicChangeWithinNode(edit: SourceFileEdit): Promise<void>;
    async makeAtomicChangeWithinNode(edits: SourceFileEdit[]): Promise<void>;
    async makeAtomicChangeWithinNode(editOrEdits: SourceFileEdit | SourceFileEdit[]): Promise<void> {
        // TODO: possibly check that all the given edits are indeed located within this node
        this.beginAtomicChange();
        await this.sourceFile.makeAtomicChange(editOrEdits);
        this.endAtomicChange(true);
    }

    async setTextContent(newContent: string): Promise<void> {
        await this.makeAtomicChangeWithinNode(editBuilder => {
            editBuilder.replace(this.range.asVscodeRange, newContent);
        });
    }

    // Dispatch a source file change to this node + every of its children in the AST
    async dispatchAndProcessChange(change: SourceFileChange): Promise<void> {
        this.processChange(change);

        let someChildNodeRequiresReparsing = false;
        for (let node of this.childNodes) {
            node.dispatchAndProcessChange(change);
            someChildNodeRequiresReparsing = someChildNodeRequiresReparsing || node.requiresReparsing;
        }

        if (this.mustReparseChildNodesOutOfSyncAfterChange
        && (this.requiresReparsing || someChildNodeRequiresReparsing)) {
            await this.reparseAndUpdate();
        }
    }

    private processChange(change: SourceFileChange): void {
        const relativePositionToModifiedRange = this.range.processChange(change);

        if (relativePositionToModifiedRange === RelativeRangePosition.Across
        || (this.isLeaf && relativePositionToModifiedRange === RelativeRangePosition.Within)) {
            this.requiresReparsing = true;
        }
    }

    protected async reparse(): Promise<P.Result<ASTNode>> {
        console.info("About to re-parse AST node:", this);
        const result = this.parser(await this.textContent, {
            sourceFile: this.sourceFile,
            range: this.range
        });

        console.log("Re-parsing result:", result);
        this.reparsingError = result.status ? null : result;
        return result;
    }

    protected async updateWith(reparsedNode: ASTNode): Promise<void> {
        this.mustReparseChildNodesOutOfSyncAfterChange = reparsedNode.mustReparseChildNodesOutOfSyncAfterChange;
    };

    protected async reparseAndUpdate(): Promise<void> {
        const result = await this.reparse();

        if (result.status) {
            const newNode = result.value;
            this.requiresReparsing = false;

            this.beforeNodeUpdateEventEmitter.fire({ newNode: newNode });
            this.updateWith(newNode);
            
            console.log("AST node update finished", this);
        }
        else {
            this.requiresReparsing = true;
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