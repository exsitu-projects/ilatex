import * as vscode from "vscode";
import { StringUtils } from "../../shared/utils/StringUtils";
import { SourceFilePositionShift } from "../source-files/SourceFilePosition";


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
    readonly shift: SourceFilePositionShift;

    // The size of a change represents how many characters have been affected by the change:
    // - how many characters have been inserted; or
    // - how many characters have been added/removed during a replacement; or
    // - how many characters have been deleted.
    readonly size: number;

    constructor(event: vscode.TextDocumentContentChangeEvent) {
        this.event = event;
        this.start = event.range.start;
        this.end = event.range.end;
        this.kind = SourceFileChange.computeKindOf(event);

        this.shift = SourceFileChange.computeShiftOf(event, this.kind);
        this.size = SourceFileChange.computeSizeOf(event, this.kind);

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

        const nbLinesOfAddedText = StringUtils.countLinesOf(event.text);
        const lengthOfLastLineOfAddedText = StringUtils.lastLineOf(event.text).length;
        
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

    private static computeSizeOf(
        event: vscode.TextDocumentContentChangeEvent,
        kind: SourceFileChangeKind
    ): number {
        switch (kind) {
            case SourceFileChangeKind.Insertion:
                return event.text.length;
            case SourceFileChangeKind.Replacement:
                return event.text.length - event.rangeLength;
            case SourceFileChangeKind.Deletion:
                return -event.rangeLength;
        }
    }

    private static computeShiftOf(
        event: vscode.TextDocumentContentChangeEvent,
        kind: SourceFileChangeKind
    ): SourceFilePositionShift {
        return {
            lines: SourceFileChange.computeLineShiftOf(event),
            columns: SourceFileChange.computeColumnShiftOf(event, kind),
            offset: SourceFileChange.computeOffsetShiftOf(event)
        };
    }
}