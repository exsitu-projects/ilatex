import * as vscode from "vscode";
import * as P from "parsimmon";
import { GridExtractor } from "./GridExtractor";
import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { CommandNode } from "../../../core/ast/nodes/CommandNode";
import { WhitespaceNode } from "../../../core/ast/nodes/WhitespaceNode";
import { SourceFilePosition } from "../../../core/source-files/SourceFilePosition";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";
import { ArrayUtils } from "../../../shared/utils/ArrayUtils";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { GridOptions } from "./GridOptions";

export class NoNodeError extends Error {}
export class NoContentError extends Error {}

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
    readonly astNodes: ASTNode[];
    readonly previousAstNode: ASTNode | null;
    readonly nextAstNode: ASTNode | null;
    readonly textContent: string;

    private constructor(
        rowIndex: number,
        columnIndex: number,
        astNodes: ASTNode[],
        previousAstNode: ASTNode | null,
        nextAstNode: ASTNode | null,
        textContent: string
    ) {
        this.rowIndex = rowIndex;
        this.columnIndex = columnIndex;
        this.astNodes = astNodes;
        this.previousAstNode = previousAstNode;
        this.nextAstNode = nextAstNode;
        this.textContent = textContent;
    }

    get containsNodes(): boolean {
        return this.astNodes.length > 0;
    }

    get containsContentNodes(): boolean {
        return this.astNodes.some(Cell.isContentNode);
    }

    get start(): SourceFilePosition {
        const firstNode = this.astNodes[0];
        if (firstNode) {
            return firstNode.range.from;
        }

        // If there is no node in the cell, we assume the node has a zero-length
        // If it has at least a previous or a next node,
        // its start position (= its end position) can be computed
        if (this.previousAstNode || this.nextAstNode) {
            return this.previousAstNode ? this.previousAstNode.range.to
            : this.nextAstNode!.range.from;
        }
        else {
            throw new NoNodeError();
        }
    }

    get end(): SourceFilePosition {
        const lastNode = this.astNodes[this.astNodes.length - 1];
        if (lastNode) {
            return lastNode.range.to;
        }

        // If there is no node in the cell, we assume the node has a zero-length
        // If it has at least a previous or a next node,
        // its end position (= its start position) can be computed
        if (this.previousAstNode || this.nextAstNode) {
            return this.previousAstNode ? this.previousAstNode.range.to
            : this.nextAstNode!.range.from;
        }
        else {
            throw new NoNodeError();
        }
    }

    get range(): SourceFileRange {
        return new SourceFileRange(
            this.start,
            this.end
        );
    }

    get firstContentNode(): ASTNode {
        const firstContentNode = Cell.firstContentNodeOf(this.astNodes);
        if (!firstContentNode) {
            throw new NoContentError();
        }

        return firstContentNode;
    }

    get lastContentNode(): ASTNode {
        const firstContentNode = Cell.lastContentNodeOf(this.astNodes);
        if (!firstContentNode) {
            throw new NoContentError();
        }

        return firstContentNode;
    }

    // The content starts where the first content node starts
    // If there is no content node in the cell, it starts at the end of the cell
    get contentStart(): SourceFilePosition {
        if (!this.containsContentNodes) {
            return this.end;
        }

        return this.firstContentNode.range.from;
    }

    // The content ends where the last content node ends
    // If there is no content node in the cell, it ends at the end of the cell
    get contentEnd(): SourceFilePosition {
        if (!this.containsContentNodes) {
            return this.end;
        }

        return this.lastContentNode.range.to;
    }

    get contentRange(): SourceFileRange {
        return new SourceFileRange(
            this.contentStart,
            this.contentEnd
        );
    }

    get hasLeadingNonContentNodes(): boolean {
        return this.containsNodes
            && this.astNodes[0] !== this.firstContentNode;
    }

    get hasTrailingNonContentNodes(): boolean {
        return this.containsNodes
            && this.astNodes[this.astNodes.length - 1] !== this.lastContentNode;
    }

    get hasLeadingWhitespace(): boolean {
        return this.containsNodes
            && this.astNodes[0] instanceof WhitespaceNode;
    }

    get hasTrailingWhitespace(): boolean {
        return this.containsNodes
            && this.astNodes[this.astNodes.length - 1] instanceof WhitespaceNode;
    }

    private static firstContentNodeOf(nodes: ASTNode[]): ASTNode | null {
        const result = ArrayUtils.firstMatch(nodes, Cell.isContentNode);
        return result.success ? result.element : null;
    }

    private static lastContentNodeOf(nodes: ASTNode[]): ASTNode | null {
        const result = ArrayUtils.lastMatch(nodes, Cell.isContentNode);
        return result.success ? result.element : null;
    }

    // "Non-content" commands and whitespace nodes are not considered as content
    static isContentNode(node: ASTNode): boolean {
        if (node instanceof CommandNode
        &&  Cell.NON_CONTENT_COMMAND_NAMES.includes(node.name)) {
            return false;
        }

        return !(node instanceof WhitespaceNode);
    }

    static async from(
        rowIndex: number,
        columnIndex: number,
        astNodes: ASTNode[],
        previousAstNode: ASTNode | null,
        nextAstNode: ASTNode | null,
    ): Promise<Cell> {
        const firstContentNode = Cell.firstContentNodeOf(astNodes);
        const lastContentNode = Cell.firstContentNodeOf(astNodes);

        let textContent = "";
        if (firstContentNode && lastContentNode) {
            textContent = await firstContentNode.sourceFile.getContent(new SourceFileRange(
                firstContentNode.range.from,
                lastContentNode.range.to
            ));
        }

        return new Cell(
            rowIndex,
            columnIndex,
            astNodes,
            previousAstNode,
            nextAstNode,
            textContent
        );
    }
}

export class Row {
    readonly rowIndex: number;
    readonly cells: Cell[];

    private constructor(rowIndex: number, cells: Cell[]) {
        this.rowIndex = rowIndex;
        this.cells = cells;
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

    static async from(rowIndex: number, cells: Cell[]): Promise<Row> {
        return new Row(rowIndex, cells);
    }
}

export class Grid {
    readonly rows: Row[];
    readonly options: GridOptions;

    constructor(rows: Row[], options: GridOptions) {
        this.rows = rows;
        this.options = options;
    }

    get nbRows(): number {
        return this.rows.length;
    }

    get lastRow(): Row {
        return this.rows[this.rows.length - 1];
    }

    static async from(tabularNode: EnvironmentNode): Promise<Grid> {
        return await GridExtractor.extractGridFrom(tabularNode);
    }
}