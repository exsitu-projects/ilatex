import * as vscode from "vscode";
import { SourceFileChange } from "../source-files/SourceFileChange";
import { PositionInFile } from "./PositionInFile";

export const enum RelativeRangePosition {
    Before = "Before",
    Within = "Within",
    Across = "Across",
    After = "After",
}

/**
 * An range between two positions in a file with possibly non-null shifts.
 * 
 * Note: this class does no guarantee that the first position is before the second one (with or without shifts),
 * i.e. the range is not guaranted to be valid at all times.
 */
export class RangeInFile {
    readonly from: PositionInFile;
    readonly to: PositionInFile;

    constructor(from: PositionInFile, to: PositionInFile) {
        this.from = from;
        this.to = to;

        // this.changeBeforeRangeEventEmitter = new vscode.EventEmitter();
        // this.changeWithinRangeEventEmitter = new vscode.EventEmitter();
        // this.changeAcrossRangeEventEmitter = new vscode.EventEmitter();
    }

    get isSingleLine(): boolean {
        return this.from.line === this.to.line;
    }

    get asVscodeRange(): vscode.Range {
        return new vscode.Range(
            this.from.asVscodePosition,
            this.to.asVscodePosition
        );
    }

    toString(): string {
        return `${this.from} –> ${this.to}`;
    }

    /**
     * Attempt to shift the start and/or end positions of the range to take the given change into account.
     * Warning: if the change occurs _across_ the range, nothing is shifted.
     * 
     * @return The position of the range relative to the modified range.
     */
    processChange(change: SourceFileChange): RelativeRangePosition {
        const fromVscodePosition = this.from.asVscodePosition;
        const toVscodePosition = this.to.asVscodePosition;

        // Case 1: this range ends strictly before the modified range.
        if (toVscodePosition.isBefore(change.start)) {
            // In this case, this range is completely unaffected: there is nothing to do.
            return RelativeRangePosition.After;
        }

        // Case 2: this range starts stricly after the modified range.
        else if (fromVscodePosition.isAfter(change.end)) {
            this.processChangeBeforeRange(change);
            return RelativeRangePosition.Before;
        }

        // Case 3: the modified range overlaps with this range.
        else if (change.event.range.intersection(this.asVscodeRange)) {
            // Case 3.1: the modified range is contained within this range
            if (change.start.isAfterOrEqual(fromVscodePosition) && change.end.isBeforeOrEqual(toVscodePosition)) {
                this.processChangeWithinRange(change);
            return RelativeRangePosition.Within;
            }

            // Case 3.2: a part of the modified range is outside the range of this range
            else {
                // If the change occurs across this range, we suppose there is too little information
                // to safely shift the start or the end position of this range, and do not shift anything.
                // Owners of ranges that care about this situation are responsible for reacting accordingly.
                return RelativeRangePosition.Across;
            }
        }

        // Case 4: this case should not happend; it is here for debugging purposes.
        else {
            console.error("Unexpected kind of source file change in RangeInFile.processChange:", change);
            throw new Error(`Unexpected kind of source file change in range ${this.toString()}`);
        }
    }

    private shiftAfterChangeBeforeRange(change: SourceFileChange): void {
        this.from.shift.lines += change.shift.lines;
        this.from.shift.offset += change.shift.offset;

        this.to.shift.lines += change.shift.lines;
        this.to.shift.offset += change.shift.offset;

        // If this range starts on the same line than the last line of the modified range,
        // the column must also be shifted.
        // It can either concern the start column only or both the start and end columns
        // (if the end column is located on the same line than the start column).
        if (this.from.asVscodePosition.line === change.end.line) {
            this.from.shift.columns += change.shift.columns;
            if (this.isSingleLine) {
                this.to.shift.columns += change.shift.columns;
            }
        }

    }

    private processChangeBeforeRange(change: SourceFileChange): void {
        this.shiftAfterChangeBeforeRange(change);
    }

    private shiftAfterChangeWithinRange(change: SourceFileChange): void {
        this.to.shift.lines += change.shift.lines;
        this.to.shift.offset += change.shift.offset;  

        // If the change ends on the same line than this range,
        // the column of the end of this range end must also be shifted.
        if (change.end.line === this.to.asVscodePosition.line) {
            this.to.shift.columns += change.shift.columns;
        }
    }


    private processChangeWithinRange(change: SourceFileChange): void {
        this.shiftAfterChangeWithinRange(change);
    }
}