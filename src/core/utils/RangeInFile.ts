import * as vscode from "vscode";
import { PositionInFile } from "./PositionInFile";


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
    }

    get asVscodeRange(): vscode.Range {
        return new vscode.Range(
            this.from.asVscodePosition,
            this.to.asVscodePosition
        );
    }
}