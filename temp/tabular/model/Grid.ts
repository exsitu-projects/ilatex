import * as vscode from "vscode";
import * as P from "parsimmon";
import { ASTEnvironementNode, ASTNode, ASTNodeType } from "../../../core/ast/LatexASTNode";
import { GridExtractor } from "./GridExtractor";

export class NoNodeError extends Error {}
export class NoContentError extends Error {}
export class NoTextContentError extends Error {}

export class Cell {
    // The choice of commands not considered as content is strongly inspired by
    // https://en.wikibooks.org/wiki/LaTeX/Tables
    private static readonly NON_CONTENT_COMMAND_NAMES: string[] = [
        "toprule",
        "midrule",
        "bottomrule",
        "hline",
        "cline"
    ];

    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly nodes: ASTNode[];

    // By default, the cell does not have any text content in cache
    // It must be updated at least once before it can be accessed
    // through the textContent property
    private cachedTextContent: string | null;

    constructor(rowIndex: number, columnIndex: number) {
        this.rowIndex = rowIndex;
        this.columnIndex = columnIndex;
        this.nodes = [];

        this.cachedTextContent = null;
    }

    get containsNodes(): boolean {
        return this.nodes.length > 0;
    }

    get containsContentNodes(): boolean {
        return this.nodes.some(Cell.isContentNode);
    }

    get start(): P.Index {
        const firstNode = this.nodes[0];
        if (!firstNode) {
            throw new NoNodeError();
        }

        return firstNode.range.from.asParsimmonIndex;
    }

    get end(): P.Index {
        const lastNode = this.nodes[this.nodes.length - 1];
        if (!lastNode) {
            throw new NoNodeError();
        }

        return lastNode.range.to.asParsimmonIndex;
    }

    private get firstContentNode(): ASTNode {
        const firstContentNode = this.nodes.find(Cell.isContentNode);
        if (!firstContentNode) {
            throw new NoContentError();
        }

        return firstContentNode;
    }

    private get lastContentNode(): ASTNode {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const currentCell = this.nodes[i];
            if (Cell.isContentNode(currentCell)) {
                return currentCell;
            }
        }
        
        throw new NoContentError();
    }

    // The content starts where the first content node starts
    // If there is no content node in the cell, it starts at the end of the cell
    get contentStart(): P.Index {
        if (!this.containsContentNodes) {
            return this.end;
        }

        return this.firstContentNode.range.from.asParsimmonIndex;
    }

    // The content ends where the last content node ends
    // If there is no content node in the cell, it ends at the end of the cell
    get contentEnd(): P.Index {
        if (!this.containsContentNodes) {
            return this.end;
        }

        return this.lastContentNode.range.to.asParsimmonIndex;
    }

    get textContent(): string {
        if (this.cachedTextContent === null) {
            throw new NoTextContentError;
        }

        return this.cachedTextContent;
    }

    // Set the textual content of the cell from the given document
    // This method should be called once the nodes of the temporary cell
    // have all been set (in order to get the full content of the cell)
    updateTextContentFrom(document: vscode.TextDocument): void {
        this.cachedTextContent = document.getText(new vscode.Range(
            new vscode.Position(this.contentStart.line - 1, this.contentStart.column - 1),
            new vscode.Position(this.contentEnd.line - 1, this.contentEnd.column - 1)
        ));
    }

    // All the "non-content" commands and the whitespace
    // nodes are not considered as content nodes
    private static isContentNode(node: ASTNode): boolean {
        if (node.type === ASTNodeType.Command
        &&  Cell.NON_CONTENT_COMMAND_NAMES.includes(node.name)) {
            return false;
        }

        return node.type !== ASTNodeType.Whitespace;
    }
}

export class Row {
    readonly rowIndex: number;
    readonly cells: Cell[];

    constructor(rowIndex: number) {
        this.rowIndex = rowIndex;
        this.cells = [];

        // Every row is initialised with an empty cell
        this.addNewEmptyCell();
    }

    get nbCells(): number {
        return this.cells.length;
    }

    get containsNodes(): boolean {
        return this.cells.some(cell => cell.containsNodes);
    }

    get containsContentNodes(): boolean {
        return this.cells.some(cell => cell.containsContentNodes);
    }

    get lastCell(): Cell {
        return this.cells[this.cells.length - 1];
    }

    addNewEmptyCell(): void {
        this.cells.push(
            new Cell(this.rowIndex, this.nbCells)
        );
    }

    updateTextContentFrom(document: vscode.TextDocument): void {
        for (let cell of this.cells) {
            cell.updateTextContentFrom(document);
        }
    }
}

export class Grid {
    readonly rows: Row[];

    constructor() {
        this.rows = [];

        // Every grid is initialised with one empty row
        this.addNewEmptyRow();
    }

    get nbRows(): number {
        return this.rows.length;
    }

    get lastRow(): Row {
        return this.rows[this.rows.length - 1];
    }

    addNewEmptyRow(): void {
        this.rows.push(
            new Row(this.nbRows)
        );
    }

    removeLastRow() {
        this.rows.pop();
    }

    updateTextContentFrom(document: vscode.TextDocument): void {
        for (let row of this.rows) {
            row.updateTextContentFrom(document);
        }
    }

    static extractFrom(tabularNode: ASTEnvironementNode, document: vscode.TextDocument): Grid {
        return GridExtractor.extractGridFrom(tabularNode, document);
    }
}