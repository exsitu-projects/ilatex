import * as vscode from "vscode";
import { ASTNode, ASTCommandNode, ASTSpecialSymbolNode, ASTEnvironementNode } from "../../../core/ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../../../core/ast/visitors/LatexASTVisitorAdapter";
import { Grid } from "./Grid";



export class GridExtractor extends LatexASTVisitorAdapter {
    private readonly grid: Grid;

    private constructor(document: vscode.TextDocument) {
        super();
        this.grid = new Grid();
    }

    // Index of the last row of the grid
    get currentRowIndex(): number {
        return this.grid.lastRow.rowIndex;
    }

    // Index of the last column of the last row of the grid
    get currentColumnIndex(): number {
        return this.grid.lastRow.lastCell.columnIndex;
    }

    private addNodeToCurrentCell(node: ASTNode) {
        this.grid.lastRow.lastCell.nodes.push(node);
    }

    // Every \\ command creates a new row, which is added to the grid
    // Every other command is treated as a cell node
    protected visitCommandNode(node: ASTCommandNode) {
        const commandName = node.name;
        if (commandName === "\\") {
            this.grid.addNewEmptyRow();
        }
        else {
            this.addNodeToCurrentCell(node);
        }
    }

    // Every & symbol creates a new cell, which is added to the current row
    // Every other special symbol is treated as a cell node
    protected visitSpecialSymbolNode(node: ASTSpecialSymbolNode) {
        const symbolName = node.name;
        if (symbolName === "ampersand") {
            this.grid.lastRow.addNewEmptyCell();
        }
        else {
            this.addNodeToCurrentCell(node);
        }
    }

    // Every node with no special meaning (cf. other visit methods of this class)
    // is treated as a regular cell node (except at depth 0—see below)
    protected visitNode(node: ASTNode, depth: number) {
        // The (only) node at depth 0 must be ignored,
        // as it is the container of all the nodes of the actual content
        if (depth === 0) {
            return;
        }

        this.addNodeToCurrentCell(node);
    }

    static extractGridFrom(tabularNode: ASTEnvironementNode, document: vscode.TextDocument): Grid {
        // Fill a new grid by visiting the AST
        const gridExtractor = new GridExtractor(document);
        const grid = gridExtractor.grid;
        tabularNode.value.content.visitWith(gridExtractor, 0, 1);

        // Remove the last row from the grid
        // if it does not contain any content node
        if (!grid.lastRow.containsContentNodes) {
            grid.removeLastRow();
        }

        // Set the text content of every cell
        grid.updateTextContentFrom(document);

        return grid;
    }
}
