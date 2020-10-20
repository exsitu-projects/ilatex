import * as vscode from "vscode";
import * as P from "parsimmon";
import { ASTEnvironementNode, ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../../../core/ast/visitors/LatexASTVisitorAdapter";
import { LatexLength } from "../../../core/utils/LatexLength";

export interface Cell {
    rowIndex: number;
    cellIndex: number;
    node: ASTEnvironementNode,
    textContent: string;
    options: {
        relativeSize: number;
    }
}

export interface Row {
    rowIndex: number;
    node: ASTEnvironementNode,
    cells: Cell[];
    options: {
        height: LatexLength;
    }
};

export interface Grid {
    rows: Row[];
    options: {
        width?: LatexLength;
    }
}

export class GridExtractor extends LatexASTVisitorAdapter {
    private document: vscode.TextDocument;
    readonly grid: Grid;
    
    private currentRow: Row | null;
    private currentRowIndex: number;
    private currentCellIndex: number;

    constructor(document: vscode.TextDocument) {
        super();
        this.document = document;
        this.grid = {
            rows: [],
            options: {}
        };

        this.currentRow = null;
        this.currentRowIndex = -1;
        this.currentCellIndex = -1;
    }

    private extractGridOptionsFromASTNode(node: ASTEnvironementNode): void {
        if (node.value.parameters[0].length > 0) {
            const parameterNode = node.value.parameters[0][0] as ASTParameterNode;
            this.grid.options.width = LatexLength.from(parameterNode.value);
        }
    }

    private createNewRow(rowNode: ASTEnvironementNode): Row {
        this.currentRowIndex += 1;
        this.currentCellIndex = -1;

        const rowHeightParameter = rowNode.value.parameters[0][0] as ASTParameterNode;
        const rowHeight = LatexLength.from(rowHeightParameter.value);

        return {
            rowIndex: this.currentRowIndex,
            node: rowNode,
            cells: [],
            options: {
                height: rowHeight
            }
        };
    }

    private createNewCell(cellNode: ASTEnvironementNode): Cell {
        this.currentCellIndex += 1;

        const cellRelativeSizeParameter = cellNode.value.parameters[0][0] as ASTParameterNode;
        const relativeSize = parseFloat(cellRelativeSizeParameter.value);
        
        return {
            rowIndex: this.currentRowIndex,
            cellIndex: this.currentCellIndex,
            node: cellNode,
            textContent: this.getCellContent(
                cellNode.value.content.start,
                cellNode.value.content.end
            ),
            options: {
                relativeSize: relativeSize
            }
        };        
    }

    private getCellContent = (start: P.Index, end: P.Index): string => {
        return this.document.getText(new vscode.Range(
            new vscode.Position(start.line - 1, start.column - 1),
            new vscode.Position(end.line - 1, end.column - 1)
        ));
    };

    // Note: this method assumes gridlayout environements are never nested
    protected visitEnvironementNode(node: ASTEnvironementNode) {
        // The gridlayout environement itself may contain options
        // that must be extracted
        if (node.name === "gridlayout") {
            this.extractGridOptionsFromASTNode(node);
        }
        
        // Every row environment inside a gridlayout environement starts a new row
        if (node.name === "row") {
            const newRow = this.createNewRow(node);

            this.currentRow = newRow;
            this.grid.rows.push(newRow);
        }

        // Every cell environment inside a gridlayout environement starts a new cell (in the current row)
        if (node.name === "cell") {
            const newCell = this.createNewCell(node);
            this.currentRow?.cells.push(newCell);
        }
    }
}