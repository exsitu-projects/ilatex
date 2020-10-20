import * as vscode from "vscode";
import * as P from "parsimmon";
import { ASTNode, ASTNodeType, ASTCommandNode, ASTSpecialSymbolNode } from "../../../core/ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../../../core/ast/visitors/LatexASTVisitorAdapter";

export interface Cell {
    rowIndex: number;
    columnIndex: number;
    contentStart: P.Index;
    contentEnd: P.Index;
    nodes: ASTNode[],
    textContent: string;
}

export interface Grid {
    // Rows of cells 
    // The first index is the row index
    // The second index is the column index
    rows: Cell[][];
}

export class GridExtractor extends LatexASTVisitorAdapter {
    // The choice of commands not considered as content is strongly inspired by
    // https://en.wikibooks.org/wiki/LaTeX/Tables
    private static readonly NON_CONTENT_COMMAND_NAMES: string[] = [
        "toprule",
        "midrule",
        "bottomrule",
        "hline",
        "cline"
    ];

    private document: vscode.TextDocument;
    readonly grid: Grid;

    // Current row and cell
    private currentRow: Cell[];
    private currentRowIndex: number;
    private currentColumnIndex: number;
    private currentCellNodes: ASTNode[];

    constructor(document: vscode.TextDocument) {
        super();

        this.document = document;
        this.grid = { rows: [] };

        this.currentRow = [];
        this.grid.rows.push(this.currentRow);

        this.currentRowIndex = 0;
        this.currentColumnIndex = 0;
        this.currentCellNodes = [];
    }

    private isCurrentCellEmpty(): boolean {
        return this.currentCellNodes.length === 0;
    }

    private getCellContent = (start: P.Index, end: P.Index): string => {
        return this.document.getText(new vscode.Range(
            new vscode.Position(start.line - 1, start.column - 1),
            new vscode.Position(end.line - 1, end.column - 1)
        ));
    };

    private getCurrentCellContentLocation(): {start: P.Index, end: P.Index} {
        const firstNode = this.currentCellNodes[0];
        const lastNode =  this.currentCellNodes[this.currentCellNodes.length - 1];

        // All the leading/trailing nodes which are
        // whitespace or "non-content" commands should be skipped
        function shouldSkipNode(node: ASTNode): boolean {
            return node.type === ASTNodeType.Whitespace
                || (node.type === ASTNodeType.Command
                    && GridExtractor.NON_CONTENT_COMMAND_NAMES.includes(node.name));
        }

        // If the cell only contains skippable nodes,
        // consider its content as an empty string located at the end of the node
        if (this.currentCellNodes.every(node => shouldSkipNode(node))) {
            return {
                start: lastNode.end,
                end: lastNode.end
            };
        }
        
        // Otherwise, update the start and end positions
        // to ignore any leading/trailing whitespace and special command nodes
        // Note: this works well since we know that at least one node won't be skipped!
        const location = {
            start: firstNode.start,
            end: lastNode.end
        };

        for (let i = 0; i < this.currentCellNodes.length; i++) {
            const node = this.currentCellNodes[i];
            if (shouldSkipNode(node)) {
                location.start = node.end;
            }
            else {
                break;
            };
        }

        for (let i = this.currentCellNodes.length - 1; i >= 0; i--) {
            const node = this.currentCellNodes[i];
            if (shouldSkipNode(node)) {
                location.end = node.start;
            }
            else {
                break;
            };
        }

        return location;
    }

    private addCurrentCellToGrid(): void {
        // Add a cell to the current row
        const {start, end} = this.getCurrentCellContentLocation();
        this.currentRow.push({
            rowIndex: this.currentRowIndex,
            columnIndex: this.currentColumnIndex,
            contentStart: start,
            contentEnd: end,
            nodes: this.currentCellNodes,
            textContent: this.getCellContent(start, end)
        });

        // Reset the array of nodes
        this.currentCellNodes = [];
    }

    protected visitCommandNode(node: ASTCommandNode) {
        const commandName = node.name;
        if (commandName === "\\") {
            if (!this.isCurrentCellEmpty()) {
                this.addCurrentCellToGrid();
            }

            // Update the current position in the grid
            this.currentRowIndex += 1;
            this.currentColumnIndex = 0;

            // Create a new row in the grid
            this.currentRow = [];
            this.grid.rows.push(this.currentRow);
        }
        else {
            this.visitNode(node);
        }
    }

    protected visitSpecialSymbolNode(node: ASTSpecialSymbolNode) {
        const symbolName = node.name;
        if (symbolName === "ampersand") {
            if (!this.isCurrentCellEmpty()) {
                this.addCurrentCellToGrid();
            }

            // Update the current position in the grid
            this.currentColumnIndex += 1;
        }
        else {
            this.visitNode(node);
        }
    }

    protected visitNode(node: ASTNode) {
        this.currentCellNodes.push(node);
    }
}