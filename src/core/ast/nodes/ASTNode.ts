import * as vscode from "vscode";
import * as P from "parsimmon";
import { RangeInFile } from "../../utils/RangeInFile";
import { SourceFileChange } from "../../source-files/SourceFileChange";
import { SourceFile, SourceFileEdit } from "../../source-files/SourceFile";
import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { ASTAsyncVisitor, ASTSyncVisitor } from "../visitors/visitors";


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
    
    // protected hasBeenEditedWithinItsRange: boolean;
    // protected hasBeenEditedAcrossItsRange: boolean;

    private isPartOfAtomicChange: boolean;

    private reparsingError: P.Failure | null;

    protected readonly beforeNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;
    protected readonly withinNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;
    protected readonly acrossNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;

    readonly textContentChangeEventEmitter: vscode.EventEmitter<ASTNode>;
    // TODO: make protected?
    readonly reparsingEndEventEmitter: vscode.EventEmitter<{node: ASTNode, result: P.Result<ASTNode>}>;

    readonly beforeNodeDetachmentEventEmitter: vscode.EventEmitter<ASTNode>;
    readonly afterNodeDetachmentEventEmitter: vscode.EventEmitter<ASTNode>;

    private childNodesToObserverDisposables: ArrayMap<ASTNode, vscode.Disposable>;

    constructor(
        context: ASTNodeContext
    ) {
        this.sourceFile = context.sourceFile;
        this.range = context.range;
        
        // this.hasBeenEditedWithinItsRange = false;
        // this.hasBeenEditedAcrossItsRange = false;

        this.isPartOfAtomicChange = false;

        this.reparsingError = null;

        this.beforeNodeUserEditEventEmitter = new vscode.EventEmitter();
        this.withinNodeUserEditEventEmitter = new vscode.EventEmitter();
        this.acrossNodeUserEditEventEmitter = new vscode.EventEmitter();

        this.textContentChangeEventEmitter = new vscode.EventEmitter();
        this.reparsingEndEventEmitter = new vscode.EventEmitter();

        this.beforeNodeDetachmentEventEmitter = new vscode.EventEmitter();
        this.afterNodeDetachmentEventEmitter = new vscode.EventEmitter();

        this.childNodesToObserverDisposables = new ArrayMap();
    }

    // get hasBeenEditedByTheUser(): boolean {
    //     return this.hasBeenEditedWithinItsRange
    //         || this.hasBeenEditedAcrossItsRange;
    // }

    get hasReparsingError(): boolean {
        return !!this.reparsingError;
    }

    get textContent(): Promise<string> {
        return this.sourceFile.getContent(this.range);
    }

    abstract get childNodes(): ASTNode[];

    private emitTextContentChangeEvent(): void {
        if (!this.isPartOfAtomicChange) {
            this.textContentChangeEventEmitter.fire(this);
        }
    }

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
            this.textContentChangeEventEmitter.fire(this);
        }

        // TODO: reparse now?
    }

    async makeAtomicChangeWithinNode(edit: SourceFileEdit): Promise<void>;
    async makeAtomicChangeWithinNode(edits: SourceFileEdit[]): Promise<void>;
    async makeAtomicChangeWithinNode(editOrEdits: SourceFileEdit | SourceFileEdit[]): Promise<void> {
        // TODO: possibly check that all the given edits are indeed located within this node
        this.beginAtomicChange();
        this.sourceFile.makeAtomicChange(editOrEdits);
        this.endAtomicChange(true);
    }

    async setTextContent(newContent: string): Promise<void> {
        await this.makeAtomicChangeWithinNode(editBuilder => {
            editBuilder.replace(this.range.asVscodeRange, newContent);
        });

        
    }

    // Dispatch a source file change to this node + every of its children in the AST
    dispatchSourceFileChange(change: SourceFileChange): void {
        this.processSourceFileChange(change);
        for (let node of this.childNodes) {
            node.dispatchSourceFileChange(change);
        }
    }

    private processSourceFileChange(change: SourceFileChange): void {
        const nodeStart = this.range.from.asVscodePosition;
        const nodeEnd = this.range.to.asVscodePosition;

        // Case 1: the node ends strictly before the modified range.
        if (nodeEnd.isBefore(change.start)) {
            // In this case, the node is completely unaffected: there is nothing to do.
            return;
        }

        // Case 2: the node starts stricly after the modified range.
        else if (nodeStart.isAfter(change.end)) {
            this.processSourceFileChangeBeforeNode(change);
        }

        // Case 3: the modified range overlaps with the range of the node.
        else if (change.event.range.intersection(this.range.asVscodeRange)) {
            // Case 3.1: the modified range is contained within the node
            if (change.start.isAfterOrEqual(nodeStart) && change.end.isBeforeOrEqual(nodeEnd)) {
                this.processSourceFileChangeWithinNode(change);
            }

            // Case 3.2: a part of the modified range is outside the range of the node
            else {
                this.processSourceFileChangeAcrossNode(change);
            }
        }

        else {
            console.error("Unexpected case in processSourceFileEdit():", change, this);
        }
    }

    private processSourceFileChangeBeforeNode(change: SourceFileChange): void {
        this.range.from.shift.lines += change.shift.lines;
        this.range.from.shift.offset += change.shift.offset;

        this.range.to.shift.lines += change.shift.lines;
        this.range.to.shift.offset += change.shift.offset;

        // Special case: the node starts on the same line than the last line of the modified range
        if (this.range.from.asVscodePosition.line === change.end.line) {
            // In this particular case, the column must also be shifted!
            // It can either concern the start column only or both the start and end columns
            // (if the end column is located on the same line than the start column)
            this.range.from.shift.columns += change.shift.columns;
            if (this.range.isSingleLine) {
                this.range.to.shift.columns += change.shift.columns;
            }
        }

        this.beforeNodeUserEditEventEmitter.fire(change);
    }

    private processSourceFileChangeWithinNode(change: SourceFileChange): void {
        this.range.to.shift.lines += change.shift.lines;
        this.range.to.shift.offset += change.shift.offset;  

        // If the change ends on the same line than the node end,
        // the column of the node end must also be shifted
        if (change.end.line === this.range.from.asVscodePosition.line) {
            this.range.to.shift.columns += change.shift.columns;
        }

        // TODO: handle re-parsing somehow

        this.withinNodeUserEditEventEmitter.fire(change);
        this.emitTextContentChangeEvent();
    }

    private processSourceFileChangeAcrossNode(change: SourceFileChange): void {
        // TODO: handle re-parsing somehow

        this.acrossNodeUserEditEventEmitter.fire(change);
        this.emitTextContentChangeEvent();
    }

    protected signalNodeWillBeDetached(): void {
        // Signal all the current child nodes of this node that they will be detached from the AST
        const childNodes = this.childNodes;
        for (let node of childNodes) {
            node.signalNodeWillBeDetached();
        }

        this.beforeNodeDetachmentEventEmitter.fire(this);
    }

    protected signalNodeHasBeenDetached(): void {
        this.afterNodeDetachmentEventEmitter.fire(this);

        // Signal all the current child nodes of this node that they have been detached from the AST
        const childNodes = this.childNodes;
        for (let node of childNodes) {
            node.signalNodeHasBeenDetached();
        }

        this.stopObservingAllChildNodes();
    }

    protected abstract replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void;

    private async reparse(): Promise<void> {
        console.info("About to re-parse AST node:", this);
        const result = this.parser(await this.textContent, {
            sourceFile: this.sourceFile,
            range: this.range
        });

        console.log("Re-parsing result:", result);
        this.reparsingError = result.status ? null : result;
        this.reparsingEndEventEmitter.fire({
            node: this,
            result: result
        });
    }

    protected startObservingChildNode(node: ASTNode): void {
        this.childNodesToObserverDisposables.add(node,
            // Observe reparsing completions (both for successes and failures)
            node.reparsingEndEventEmitter.event(async ({node, result}) => {
                // If the reparsing was successful, replace the child node with the newly parsed one
                if (result.status) {
                    node.signalNodeWillBeDetached();
                    this.replaceChildNode(node, result.value);
                    node.signalNodeHasBeenDetached();
                }
                // Otherwise, try to reparse this node
                else {
                    await this.reparse();
                }
            })
        ); 
    }

    protected startObservingAllChildNodes(): void {
        const childNodes = this.childNodes;
        for (let node of childNodes) {
            this.startObservingChildNode(node);
        }
    }

    protected stopObservingChildNode(node: ASTNode): void {
        const disposables = this.childNodesToObserverDisposables.getValuesOf(node);
        for (let disposable of disposables) {
            disposable.dispose();
        }
    }

    protected stopObservingAllChildNodes(): void {
        for (let node of this.childNodes) {
            this.stopObservingChildNode(node);
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