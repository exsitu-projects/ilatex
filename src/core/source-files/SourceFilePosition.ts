import * as vscode from "vscode";
import * as P from "parsimmon";
import { RawSourceFilePosition } from "../../shared/source-files/types";


/** Value representing an unspecified offset for a position in code. */
export const UNSPECIFIED_OFFSET = Symbol("Unspecific code position offset");
export type UnspecifiedOffset = typeof UNSPECIFIED_OFFSET;

/** An offset can either be a number (if specified) or left unspecified. */
type Offset = number | UnspecifiedOffset;

export class UnspecifiedOffsetError {}

/** The amount of shift of a position in a file. */
export interface SourceFilePositionShift {
    lines: number;
    columns: number;
    offset: number;
};


/**
 * An position in a file with a line, a column, an optional offset, and a possibly non-null shift.
 * The shift is meant to be used to track a position in a file with unsaved edits.
 */
export class SourceFilePosition {
    // Line, column and offset are all 0-based
    readonly initialLine: number;
    readonly initialColumn: number;
    readonly initialOffset: Offset;

    /**
     * Editable shift whose values must be relative to the initial position
     * (in terms of positive or negative additions to the line, column and offset.)
     */
    readonly shift: SourceFilePositionShift;

    constructor(line: number, column: number, offset: Offset = UNSPECIFIED_OFFSET) {
        this.initialLine = line;
        this.initialColumn = column;
        this.initialOffset = offset;

        this.shift = {
            lines: 0,
            columns: 0,
            offset: 0
        };
    }

    /** Zero-based line number (with a possible shift). */
    get line(): number {
        return this.initialLine + this.shift.lines;
    }

    /** Zero-based column number (with a possible shift). */
    get column(): number {
        return this.initialColumn + this.shift.columns;
    }

    /**
     * File offset (with a possible shift).
     * If the initial offset is unspecified, throw an [[UnspecifiedOffsetError]].
     */
    get offset(): number {
        if (this.initialOffset === UNSPECIFIED_OFFSET) {
            throw new UnspecifiedOffsetError();
        }

        return this.initialOffset + this.shift.offset;
    }

    get hasOffset(): boolean {
        return this.initialOffset !== UNSPECIFIED_OFFSET;
    }

    get asVscodePosition(): vscode.Position {
        return new vscode.Position(this.line, this.column);
    }

    get asParsimmonIndex(): P.Index {
        return {
            line: this.line + 1,
            column: this.column + 1,
            offset: this.offset
        };
    }

    get raw(): RawSourceFilePosition {
        return {
            line: this.line,
            column: this.column
        };
    }

    with(partialPosition: Partial<Record<"line" | "column" | "offset", number>>): SourceFilePosition {
        return new SourceFilePosition(
            this.line + (partialPosition["line"] ?? 0),
            this.column + (partialPosition["column"] ?? 0),
            this.offset + (partialPosition["offset"] ?? 0)
        );
    }

    toString(): string {
        return `[Ln ${this.line} Col ${this.column}]`;
    }

    isBefore(otherPosition: SourceFilePosition): boolean {
        return this.asVscodePosition.isBefore(otherPosition.asVscodePosition);
    }

    isBeforeOrEqual(otherPosition: SourceFilePosition): boolean {
        return this.asVscodePosition.isBeforeOrEqual(otherPosition.asVscodePosition);
    }

    isEqual(otherPosition: SourceFilePosition): boolean {
        return this.asVscodePosition.isEqual(otherPosition.asVscodePosition);
    }

    isAfterOrEqual(otherPosition: SourceFilePosition): boolean {
        return this.asVscodePosition.isAfterOrEqual(otherPosition.asVscodePosition);
    }

    isAfter(otherPosition: SourceFilePosition): boolean {
        return this.asVscodePosition.isAfter(otherPosition.asVscodePosition);
    }

    static fromVscodePosition(position: vscode.Position): SourceFilePosition {
        return new SourceFilePosition(position.line, position.character);
    }

    static fromParsimmonIndex(index: P.Index): SourceFilePosition {
        return new SourceFilePosition(index.line - 1, index.column - 1, index.offset);
    }

    /** Standard comparison function that can be used for sorting positions in ascending order (e.g. with Array.sort). */
    static compareInAscendingOrder(position1: SourceFilePosition, position2: SourceFilePosition): number {
        return position1.isBefore(position2) ? -1
            :  position1.isAfter(position2) ? +1
            :  0;
    }
}