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


export const enum ASTNodeSyncStatus {
    InSync = "InSync",
    OutOfSync = "OutOfSync",
    ChildOutOfSync = "ChildOutOfSync",
    ReparsingFailed = "ReparsingFailed",
}


export abstract class ASTNode {
    readonly abstract type: string;
    protected abstract parser: ASTNodeParser<ASTNode>;
    readonly sourceFile: SourceFile;
    readonly range: RangeInFile;
    protected readonly abstract isLeaf: boolean;

    mustReparseChildNodesOutOfSyncAfterChange: boolean;
    private mayBeSyntacticallyIncorrect: boolean;

    private isPartOfAtomicChange: boolean;
    private reparsingError: P.Failure | null;

    protected syncStatus: ASTNodeSyncStatus;

    // readonly reparsingRequestEventEmitter: vscode.EventEmitter<ASTNode>;

    readonly rangeChangeEventEmitter: vscode.EventEmitter<void>;
    readonly contentChangeEventEmitter: vscode.EventEmitter<void>;
    readonly beforeNodeUpdateEventEmitter: vscode.EventEmitter<{ newNode: ASTNode }>;


    // readonly beforeNodeDetachmentEventEmitter: vscode.EventEmitter<ASTNode>;
    // readonly afterNodeDetachmentEventEmitter: vscode.EventEmitter<ASTNode>;

    // private childNodesToObserverDisposables: ArrayMap<ASTNode, vscode.Disposable>;

    constructor(
        context: ASTNodeContext
    ) {
        this.sourceFile = context.sourceFile;
        this.range = context.range;

        this.mustReparseChildNodesOutOfSyncAfterChange = false;
        this.mayBeSyntacticallyIncorrect = false;

        this.isPartOfAtomicChange = false;
        this.reparsingError = null;

        this.syncStatus = ASTNodeSyncStatus.InSync;

        // this.reparsingRequestEventEmitter = new vscode.EventEmitter();

        this.rangeChangeEventEmitter = new vscode.EventEmitter();
        this.contentChangeEventEmitter = new vscode.EventEmitter();
        this.beforeNodeUpdateEventEmitter = new vscode.EventEmitter();
        // this.reparsingEndEventEmitter = new vscode.EventEmitter();
        // this.updateEndEventEmitter = new vscode.EventEmitter();

        // this.beforeNodeDetachmentEventEmitter = new vscode.EventEmitter();
        // this.afterNodeDetachmentEventEmitter = new vscode.EventEmitter();

        // this.childNodesToObserverDisposables = new ArrayMap();
    }

    // get hasReparsingError(): boolean {
    //     return !!this.reparsingError;
    // }

    // get needsToBeReparsed(): boolean {
    //     return this.mayBeSyntacticallyIncorrect;
    // }

    get isOutOfSync(): boolean {
        return this.syncStatus === ASTNodeSyncStatus.OutOfSync
            || this.syncStatus === ASTNodeSyncStatus.ChildOutOfSync
            || this.syncStatus === ASTNodeSyncStatus.ReparsingFailed;
    }

    // get hasChildNodeOutOfSync(): boolean {
    //     return this.childNodes.some(node => node.isOutOfSync);
    // }

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

        let someChildNodeIsOutOfSync = false;
        for (let node of this.childNodes) {
            node.dispatchAndProcessChange(change);
            someChildNodeIsOutOfSync = someChildNodeIsOutOfSync || node.isOutOfSync;
        }

        if (this.syncStatus === ASTNodeSyncStatus.InSync && someChildNodeIsOutOfSync) {
            this.syncStatus = ASTNodeSyncStatus.ChildOutOfSync;
        }

        if (this.isOutOfSync && this.mustReparseChildNodesOutOfSyncAfterChange) {
            // console.log("Out of sync after processing change", this);
            await this.reparseAndUpdate();
        }
    }

    private processChange(change: SourceFileChange): void {
        const relativePositionToModifiedRange = this.range.processChange(change);

        if (relativePositionToModifiedRange === RelativeRangePosition.Across) {
            this.syncStatus = ASTNodeSyncStatus.OutOfSync;
        }
        else if (this.isLeaf && relativePositionToModifiedRange === RelativeRangePosition.Within) {
            this.syncStatus = ASTNodeSyncStatus.OutOfSync;
        }  
        
        

        // switch (nodeRangeRelativeToModifiedRange) {
        //     case RelativeRangePosition.Before:
        //         // Nothing else to do
        //         break;

        //     case RelativeRangePosition.Within:
        //         if (this.isLeaf) {
        //             this.mayBeSyntacticallyIncorrect = true;
        //         }
        //         break;

        //     case RelativeRangePosition.Across:
        //         this.mayBeSyntacticallyIncorrect = true;
        //         // Emit an event to signal this node has been modified across its range

        //         break;

        //     case RelativeRangePosition.After:
        //         // Nothing else to do
        //         break;
        // }

        // if (nodeRangeRelativeToModifiedRange === RelativeRangePosition.Across) {
        //     this.reparse();
        // }

        // else if (nodeRangeRelativeToModifiedRange === RelativeRangePosition.Within
        //         ) {
        //     this.reparse();
        // }
        // if (!this.isPartOfAtomicChange) {
        //     this.contentChangeEventEmitter.fire(this);
        // }
    }

    // protected abstract tryToReplaceChildNodesOutOfSync(): Promise<boolean>;/* {
    //     await Promise.all(this.childNodes.map(node => {
    //         if (node.needsToBeReparsed) {
    //             node.reparse()
    //                 .then(

    //                 );
    //         }
    //     }));
    // }*/

    // protected signalNodeWillBeDetached(): void {
    //     // Signal all the current child nodes of this node that they will be detached from the AST
    //     const childNodes = this.childNodes;
    //     for (let node of childNodes) {
    //         node.signalNodeWillBeDetached();
    //     }

    //     // this.beforeNodeDetachmentEventEmitter.fire(this);
    // }

    // protected signalNodeHasBeenDetached(): void {
    //     // this.afterNodeDetachmentEventEmitter.fire(this);

    //     // Signal all the current child nodes of this node that they have been detached from the AST
    //     const childNodes = this.childNodes;
    //     for (let node of childNodes) {
    //         node.signalNodeHasBeenDetached();
    //     }

    //     // this.stopObservingAllChildNodes();
    // }

    // protected abstract replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void;

    // private async reparse(): Promise<void> {
    //     console.info("About to re-parse AST node:", this);
    //     const result = this.parser(await this.textContent, {
    //         sourceFile: this.sourceFile,
    //         range: this.range
    //     });

    //     console.log("Re-parsing result:", result);
    //     this.reparsingError = result.status ? null : result;
    //     this.reparsingEndEventEmitter.fire({
    //         node: this,
    //         result: result
    //     });
    // }

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

            // this.signalNodeWillBeDetached();
            this.beforeNodeUpdateEventEmitter.fire({ newNode: newNode });
            this.updateWith(newNode);
            // this.signalNodeHasBeenDetached();

            this.syncStatus = ASTNodeSyncStatus.InSync;
            console.log("AST node update finished", this);
        }
        else {
            this.syncStatus = ASTNodeSyncStatus.ReparsingFailed;
        }
    }

    // protected startObservingChildNode(node: ASTNode): void {
    //     this.childNodesToObserverDisposables.add(node,
    //         // Observe reparsing completions (both for successes and failures)
    //         node.reparsingEndEventEmitter.event(async ({node, result}) => {
    //             // If the reparsing was successful, replace the child node with the newly parsed one
    //             if (result.status) {
    //                 node.signalNodeWillBeDetached();
    //                 this.replaceChildNode(node, result.value);
    //                 node.signalNodeHasBeenDetached();
    //             }
    //             // Otherwise, try to reparse this node
    //             else {
    //                 await this.reparse();
    //             }
    //         })
    //     ); 
    // }

    // protected startObservingAllChildNodes(): void {
    //     const childNodes = this.childNodes;
    //     for (let node of childNodes) {
    //         this.startObservingChildNode(node);
    //     }
    // }

    // protected stopObservingChildNode(node: ASTNode): void {
    //     const disposables = this.childNodesToObserverDisposables.getValuesOf(node);
    //     for (let disposable of disposables) {
    //         disposable.dispose();
    //     }
    // }

    // protected stopObservingAllChildNodes(): void {
    //     for (let node of this.childNodes) {
    //         this.stopObservingChildNode(node);
    //     }
    // }

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