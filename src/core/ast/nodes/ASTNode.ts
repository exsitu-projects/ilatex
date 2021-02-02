import * as vscode from "vscode";
import * as P from "parsimmon";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { PositionInFile } from "../../utils/PositionInFile";
import { RangeInFile } from "../../utils/RangeInFile";
import { SourceFileChange } from "../../mappings/SourceFileChange";
import { SourceFile } from "../../mappings/SourceFile";


export type ASTNodeParser<T extends ASTNode> = (input: string) => P.Result<T>;


export interface ASTNodeContext {
    range: RangeInFile,
    sourceFile: SourceFile
};


export abstract class ASTNode {
    readonly abstract type: string;
    protected abstract parser: ASTNodeParser<ASTNode>;
    readonly sourceFile: SourceFile;
    readonly range: RangeInFile;
    
    protected hasBeenEditedWithinItsRange: boolean;
    protected hasBeenEditedAcrossItsRange: boolean;

    private reparsingError: P.Failure | null;

    readonly beforeNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;
    readonly withinNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;
    readonly acrossNodeUserEditEventEmitter: vscode.EventEmitter<SourceFileChange>;

    readonly parsingFailureEventEmitter: vscode.EventEmitter<P.Failure>;

    readonly beforeNodeDetachmentEventEmitter: vscode.EventEmitter<ASTNode>;
    readonly afterNodeDetachmentEventEmitter: vscode.EventEmitter<ASTNode>;

    constructor(
        context: ASTNodeContext
    ) {
        this.sourceFile = context.sourceFile;
        this.range = context.range;
        // this.parser = context.parser;

        this.hasBeenEditedWithinItsRange = false;
        this.hasBeenEditedAcrossItsRange = false;

        this.reparsingError = null;

        this.beforeNodeUserEditEventEmitter = new vscode.EventEmitter();
        this.withinNodeUserEditEventEmitter = new vscode.EventEmitter();
        this.acrossNodeUserEditEventEmitter = new vscode.EventEmitter();

        this.parsingFailureEventEmitter =  new vscode.EventEmitter();

        this.beforeNodeDetachmentEventEmitter = new vscode.EventEmitter();
        this.afterNodeDetachmentEventEmitter = new vscode.EventEmitter();
    }

    get hasBeenEditedByTheUser(): boolean {
        return this.hasBeenEditedWithinItsRange
            || this.hasBeenEditedAcrossItsRange;
    }

    get hasReparsingError(): boolean {
        return !!this.reparsingError;
    }

    processSourceFileEdit(change: SourceFileChange): void {
        const nodeStart = this.range.from.asVscodePosition;
        const nodeEnd = this.range.to.asVscodePosition;

        // Case 1: the node ends strictly before the modified range.
        if (nodeEnd.isBefore(change.start)) {
            // In this case, the node is completely unaffected: there is nothing to do.
            return;
        }

        // Case 2: the node starts stricly after the modified range.
        else if (nodeStart.isAfter(change.end)) {
            this.processUserEditBeforeNode(change);
        }

        // Case 3: the modified range overlaps with the range of the node.
        else if (change.event.range.intersection(this.range.asVscodeRange)) {
            // Case 3.1: the modified range is contained within the node
            if (change.start.isAfterOrEqual(nodeStart) && change.end.isBeforeOrEqual(nodeEnd)) {
                this.processUserEditWithinNode(change);
            }

            // Case 3.2: a part of the modified range is outside the range of the node
            else {
                this.processUserEditAcrossNode(change);
            }
        }

        else {
            console.error("Unexpected case in processSourceFileEdit():", change, this);
        }
    }

    private processUserEditBeforeNode(change: SourceFileChange): void {
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

    private processUserEditWithinNode(change: SourceFileChange): void {
        this.range.to.shift.lines += change.shift.lines;
        this.range.to.shift.offset += change.shift.offset;  

        // If the change ends on the same line than the node end,
        // the column of the node end must also be shifted
        if (change.end.line === this.range.from.asVscodePosition.line) {
            this.range.to.shift.columns += change.shift.columns;
        }

        // this.hasUnhandledEdits = true;
        this.hasBeenEditedWithinItsRange = true;
        this.withinNodeUserEditEventEmitter.fire(change);
    }

    private processUserEditAcrossNode(change: SourceFileChange): void {
        // this.hasUnhandledEdits = true;
        this.hasBeenEditedAcrossItsRange = true;
        this.acrossNodeUserEditEventEmitter.fire(change);
    }

    async getContentIn(sourceFile: SourceFile): Promise<string> {
        return sourceFile.document.getText(this.range.asVscodeRange);
    }

    protected updateWith(newNode: ASTNode): void {
        
    }

    protected onBeforeSelfUpdate(): void {

    }

    protected onAfterSelfUpdate(): void {
        
    }

    async reparseIn(sourceFile: SourceFile): Promise<void> {
        const text = await this.getContentIn(sourceFile);
        const result = this.parser(text);

        if (result.status) {
            this.reparsingError = null;

            this.onBeforeSelfUpdate();
            this.updateWith(result.value);
            this.onAfterSelfUpdate();
        }
        else {
            this.reparsingError = result;
            this.parsingFailureEventEmitter.fire(result);
        }
    }

    // protected async onChildNodeParsingFailure(childNode: ASTNode): void {
    //     await this.reparseIn();
    // }

    protected startObservingChildNodeParsingFailure(): void {

    }

    protected stopObservingChildNodeParsingFailure(): void {
        
    }

    abstract visitWith(visitor: ASTVisitor, depth: number, maxDepth: number): void;
}