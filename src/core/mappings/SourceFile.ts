import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { LatexAST } from "../ast/LatexAST";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";
import { ASTNode } from "../ast/LatexASTNode";
import { RangeInFile } from "../utils/RangeInFile";

const enum FileChangeKind {
    Insertion = "Insertion",
    Deletion = "Deletion",
    Replacement = "Replacement"
}

export class NotInitialisedError {}

export class SourceFile {
    readonly absolutePath: string;
    readonly name: string;

    private cachedDocument: vscode.TextDocument | null;
    private cachedAst: LatexAST | null;

    // private fileChangeDisposable: vscode.Disposable;

    constructor(absolutePath: string) {
        this.absolutePath = absolutePath;
        this.name = path.basename(absolutePath);

        this.cachedDocument = null;
        this.cachedAst = null;

        // this.fileChangeDisposable = vscode.workspace.onDidChangeTextDocument(
        //     async (event) => await this.onFileChange(event)
        // );
    }

    get document(): vscode.TextDocument {
        if (!this.cachedDocument) {
            console.error("The document of the source file cannot be retrieved if the latter has not been initialised.");
            throw new NotInitialisedError();
        }

        if (this.cachedDocument.isClosed) {
            console.warn("The requested document is closed. It is not synchronised anymore!");
        }

        return this.cachedDocument;
    }

    get editor(): vscode.TextEditor | null {
        return vscode.window.visibleTextEditors.find(editor => {
            return editor.document.uri.path === this.absolutePath;
        }) ?? null;
    }

    get isDisplayedInEditor(): boolean {
        return this.editor !== null;
    }

    get ast(): LatexAST {
        if (!this.cachedAst) {
            console.error("The AST of the source file cannot be retrieved if the latter has not been initialised.");
            throw new NotInitialisedError();
        }

        return this.cachedAst;
    }

    async displayInEditor(): Promise<vscode.TextEditor> {
        if (!this.document) {
            console.error("The source file cannot be displayed in the editor if the latter has not been initialised.");
            throw new NotInitialisedError();
        }
        
        return vscode.window.showTextDocument(this.document, vscode.ViewColumn.One);
    }

    async getOrDisplayInEditor(): Promise<vscode.TextEditor> {
        return this.editor ?? await this.displayInEditor();
    }

    private async openAsDocument(): Promise<vscode.TextDocument> {
        return vscode.workspace.openTextDocument(this.absolutePath);
    }

    private parseDocument(): LatexAST {
        return new LatexAST(this.cachedDocument!.getText());
    }

    async openAndParseDocument(): Promise<void> {
        this.cachedDocument = await this.openAsDocument();
        this.cachedAst = this.parseDocument();
    }

    async saveDocument(): Promise<void> {
        const document = this.document;
        if (!document.isDirty) {
            return;
        }

        const success = await this.document.save();
        // console.log(`${this.absolutePath} has been saved`);
        if (!success) {
            console.error("An error occured when trying to save the source file.");
        }
    }

    readContentSync(): string {
        return fs.readFileSync(this.absolutePath)
            .toString();
    }

    readContentSplitByLineSync(): string[] {
        return this.readContentSync()
            .replace(/\r\n/g,"\n") /* to cope with Windows' EOL */
            .split("\n");
    }

    async processFileChange(changeEvents: vscode.TextDocumentChangeEvent): Promise<void> {
        for (let change of changeEvents.contentChanges) {
            const changeStart = change.range.start;
            const changeEnd = change.range.end;

            let changeKind = FileChangeKind.Replacement;
            if (change.text.length === 0) { changeKind = FileChangeKind.Deletion; }
            else if (change.rangeLength === 0) { changeKind = FileChangeKind.Insertion; }

            // The line shift is given by the number of new lines minus the number of lines in the edited range.
            const lineShift =  (change.text.match(/\n/g) || "").length // nb. lines added
                     - (change.range.end.line - change.range.start.line); // nb. lines removed/replaced

            // The offset shift is given by the length of the new text minus the length of the edited range.
            const offsetShift = change.text.length - change.rangeLength;

            // Note: the column shift only makes sense for a node that starts on the same line than the end of the edited range;
            // and in this case, it cannot be computed without knowing the current column of the node start.
            const shiftLineAndOffsetOf = (node: ASTNode) => {
                node.range.from.shift.lines += lineShift;
                node.range.from.shift.offset += offsetShift;

                node.range.to.shift.lines += lineShift;
                node.range.to.shift.offset += offsetShift;                
            };

            const nbLinesOfAddedText = (change.text.match(/\n/g) || []).length + 1;
            const lastNewlineIndex = change.text.lastIndexOf("\n");
            const startIndexOfLastLineOfAddedText = lastNewlineIndex + 1;
            const lengthOfLastLineOfAddedText = change.text.substring(startIndexOfLastLineOfAddedText).length;

            // console.log("Change kind:", changeKind);
            // console.log("Change:", change);
            // console.log("Shift:", lineShift, offsetShift);

            for (let node of this.ast.nodes) {
                const nodeStart = node.range.from.asVscodePosition;
                const nodeEnd = node.range.to.asVscodePosition;

                // Case 1: the node ends strictly before the modified range.
                if (nodeEnd.isBefore(changeStart)) {
                    // In this case, the node is completely unaffected: there is nothing to do.
                    continue;
                }

                // Case 2: the node starts stricly after the modified range.
                else if (nodeStart.isAfter(changeEnd)) {
                    // Case 2.1: the node starts on the same line than the last line of the modified range
                    if (nodeStart.line === changeEnd.line) {
                        shiftLineAndOffsetOf(node);
                        
                        // In this particular case, the column must also be shifted!
                        // It can either concern the start column only or both the start and end columns
                        // (if the end column is located on the same line than the start column)
                        let columnShift = 0;

                        if (changeKind === FileChangeKind.Insertion) {
                            columnShift = nbLinesOfAddedText === 1
                                ? lengthOfLastLineOfAddedText // if the node start is shifted on the same line
                                : lengthOfLastLineOfAddedText - changeStart.character; // if the node start is moved to another line
                        }
                        else if (changeKind === FileChangeKind.Deletion) {
                            columnShift = change.range.isSingleLine
                                ? changeStart.character - changeEnd.character
                                : changeStart.character - changeEnd.character;
                        }
                        else if (changeKind === FileChangeKind.Replacement) {
                            columnShift = change.range.isSingleLine
                                ? lengthOfLastLineOfAddedText - change.rangeLength // if the node start is shifted on the same line
                                : lengthOfLastLineOfAddedText - changeEnd.character; // if the node start is moved to another line
                        }

                        node.range.from.shift.column += columnShift;
                        if (node.range.isSingleLine) {
                            node.range.to.shift.column += columnShift;
                        }
                    }

                    // Case 2.2: the node starts on a line below the last line of the modified range.
                    else {
                        shiftLineAndOffsetOf(node);
                    }
                }

                // Case 3: the modified range overlaps with the range of the node.
                else if (change.range.intersection(node.range.asVscodeRange)) {
                    // Case 3.1: the modified range is contained within the node
                    if (changeStart.isAfterOrEqual(nodeStart) && changeEnd.isBeforeOrEqual(nodeEnd)) {
                        // In this case, only shift the end of the node
                        node.range.to.shift.lines += lineShift;
                        node.range.to.shift.offset += offsetShift;  

                        // If the change ends on the same line than the node end,
                        // the column of the node end must also be shifted
                        if (changeEnd.line === nodeEnd.line) {
                            // TODO: implement

                            let columnShift = 0;

                            if (changeKind === FileChangeKind.Insertion) {
                                columnShift = nbLinesOfAddedText === 1
                                    ? lengthOfLastLineOfAddedText // if the node start is shifted on the same line
                                    : lengthOfLastLineOfAddedText - changeStart.character; // if the node start is moved to another line
                            }
                            else if (changeKind === FileChangeKind.Deletion) {
                                columnShift = change.range.isSingleLine
                                    ? changeStart.character - changeEnd.character
                                    : changeStart.character - changeEnd.character;
                            }
                            else if (changeKind === FileChangeKind.Replacement) {
                                columnShift = change.range.isSingleLine
                                    ? lengthOfLastLineOfAddedText - change.rangeLength // if the node start is shifted on the same line
                                    : lengthOfLastLineOfAddedText - changeEnd.character; // if the node start is moved to another line
                            }

                            node.range.to.shift.column += columnShift;
                        }

                        node.onWitihinNodeUserEdit(change);
                    }

                    // Case 3.2: a part of the modified range is outside the range of the node
                    else {
                        node.onAcrossNodeUserEdit(change);
                    }
                }

                else {
                    console.error("Unexpected case 4", change, node);
                }
            }
        }
    }
}