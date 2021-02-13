import * as vscode from "vscode";
import { PositionShift } from "../utils/PositionInFile";


export const enum SourceFileChangeKind {
    Insertion = "Insertion",
    Deletion = "Deletion",
    Replacement = "Replacement"
}


export class SourceFileChange {
    readonly event: vscode.TextDocumentContentChangeEvent;
    readonly start: vscode.Position;
    readonly end: vscode.Position;
    readonly kind: SourceFileChangeKind;

    // Note: be careful, the shift values may not make sense for every node!
    // In particular, the column shift is only meaningful in a few particular cases.
    readonly shift: PositionShift;

    constructor(event: vscode.TextDocumentContentChangeEvent) {
        this.event = event;
        this.start = event.range.start;
        this.end = event.range.end;
        this.kind = SourceFileChange.computeKindOf(event);

        this.shift = SourceFileChange.computeShiftOf(event, this.kind);

        // console.log("Source file change:", this);
    }

    private static computeKindOf(event: vscode.TextDocumentContentChangeEvent): SourceFileChangeKind {
        if (event.text.length === 0) {
            return SourceFileChangeKind.Deletion;
        }
        else if (event.rangeLength === 0) {
            return SourceFileChangeKind.Insertion;
        }
        else {
            return SourceFileChangeKind.Replacement;
        }
    }

    // The line shift is given by the number of new lines minus the number of lines in the edited range.
    private static computeLineShiftOf(event: vscode.TextDocumentContentChangeEvent): number {
        return (event.text.match(/\n/g) || "").length // nb. lines added
             - (event.range.end.line - event.range.start.line); // nb. lines removed/replaced
    }

    // The column shift depends on the kind of change this is, and possibly on some other properties of the change (such as the length of the last line of added text).
    // It is only meaningful for 
    private static computeColumnShiftOf(
        event: vscode.TextDocumentContentChangeEvent,
        kind: SourceFileChangeKind
    ): number {
        const start = event.range.start;
        const end = event.range.end;

        const nbLinesOfAddedText = (event.text.match(/\n/g) || []).length + 1;
        const lastNewlineIndex = event.text.lastIndexOf("\n");
        const startIndexOfLastLineOfAddedText = lastNewlineIndex + 1;
        const lengthOfLastLineOfAddedText = event.text.substring(startIndexOfLastLineOfAddedText).length;
        
        switch (kind) {
            case SourceFileChangeKind.Insertion:
                return  nbLinesOfAddedText === 1
                    ? lengthOfLastLineOfAddedText // if the node start is shifted on the same line
                    : lengthOfLastLineOfAddedText - start.character; // if the node start is moved to another line

            case SourceFileChangeKind.Deletion:
                return start.character - end.character;

            case SourceFileChangeKind.Replacement:
                return event.range.isSingleLine
                    ? lengthOfLastLineOfAddedText - event.rangeLength // if the node start is shifted on the same line
                    : lengthOfLastLineOfAddedText - end.character; // if the node start is moved to another line
        }
    }

    // The offset shift is given by the length of the new text minus the length of the edited range.
    private static computeOffsetShiftOf(event: vscode.TextDocumentContentChangeEvent): number {
        return event.text.length - event.rangeLength;
    }

    private static computeShiftOf(
        event: vscode.TextDocumentContentChangeEvent,
        kind: SourceFileChangeKind
    ): PositionShift {
        return {
            lines: SourceFileChange.computeLineShiftOf(event),
            columns: SourceFileChange.computeColumnShiftOf(event, kind),
            offset: SourceFileChange.computeOffsetShiftOf(event)
        };
    }
}