import * as vscode from "vscode";
import * as P from "parsimmon";


/** Value representing an unspecified offset for a position in code. */
export const UNSPECIFIED_OFFSET = Symbol("Unspecific code position offset");
export type UnspecifiedOffset = typeof UNSPECIFIED_OFFSET;

/** An offset can either be a number (if specified) or left unspecified. */
type Offset = number | UnspecifiedOffset;

export class UnspecifiedOffsetError {}

/** The amount of shift of a position in a file. */
export interface PositionShift {
    lines: number;
    column: number;
    offset: number;
};


/**
 * An position in a file with a line, a column, an optional offset, and a possibly non-null shift.
 * The shift is meant to be used to track a position in a file with unsaved edits.
 */
export class PositionInFile {
    // Line, column and offset are all 0-based
    readonly initialLine: number;
    readonly initialColumn: number;
    readonly initialOffset: Offset;

    /**
     * Editable shift whose values must be relative to the initial position
     * (in terms of positive or negative additions to the line, column and offset.)
     */
    readonly shift: PositionShift;

    constructor(line: number, column: number, offset: Offset = UNSPECIFIED_OFFSET) {
        this.initialLine = line;
        this.initialColumn = column;
        this.initialOffset = offset;

        this.shift = {
            lines: 0,
            column: 0,
            offset: 0
        };
    }

    /** Zero-based line number (with a possible shift). */
    get line(): number {
        return this.initialLine + this.shift.lines;
    }

    /** Zero-based column number (with a possible shift). */
    get column(): number {
        return this.initialColumn + this.shift.column;
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

    static fromVscodePosition(position: vscode.Position): PositionInFile {
        return new PositionInFile(position.line, position.character);
    }

    static fromParsimmonIndex(index: P.Index): PositionInFile {
        return new PositionInFile(index.line - 1, index.column - 1, index.offset);
    }
}