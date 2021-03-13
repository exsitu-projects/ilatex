import { AtomicSourceFileEditor, SourceFileEditProvider } from "../../../core/source-files/AtomicSourceFileEditor";
import { SourceFilePosition } from "../../../core/source-files/SourceFilePosition";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { Row, Cell, Layout } from "./Layout";
import { getRelativeSizeAsString } from "./model";

const INDENT_SIZE = 2;

function getInsertPositionOfRow(layout: Layout, rowIndex: number): SourceFilePosition {
    const nbRows = layout.nbRows;
    const isNewLastRow = rowIndex > layout.lastRow.rowIndex;

    // A new row should be inserted
    // - at the start of the env. body if the index is 0 and there is no row, or
    // - before the row with the given index if there is one, or
    // - at the end of the last row if the index is greater than its row index
    if (nbRows > 0) {
        return isNewLastRow
            ? layout.lastRow.astNode.range.to
            : layout.rows[rowIndex].astNode.range.from;
    }

    return layout.astNode.body.range.from;
}

function getInsertPositionOfCell(row: Row, cellIndex: number): SourceFilePosition {
    const nbCells = row.nbCells;
    const isNewLastCell = nbCells === 0 || cellIndex > row.lastCell.cellIndex;

    // A new cell should be inserted
    // - at the start of the row body if the index is 0 and there is no cell, or
    // - before the cell with the given index if there is one, or
    // - at the end of the last cell if the index is greater than its cell index
    if (nbCells > 0) {
        return isNewLastCell
            ? row.lastCell.astNode.range.to
            : row.cells[cellIndex].astNode.range.from;
    }

    return row.astNode.body.range.from;
}

export const edits = {
    normalizeRowSizes(rows: Row[]): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            // Compute the sum of the relative sizes over all the given rows
            // If they already sum to 1, there is nothing to do
            const rowSizesSum = rows.reduce((sum, row) => sum + row.options.relativeSize, 0);
            if (rowSizesSum === 1) {
                return;
            }
    
            // Otherwise, scale every size (up or down) to ensure the sizes sum to 1
            for (let row of rows) {
                const newSize = row.options.relativeSize / rowSizesSum;
                editor.replace(
                    row.options.relativeSizeParameterNode.range,
                    getRelativeSizeAsString(newSize)
                );
            }
        };
    },

    normalizeCellSizes(cells: Cell[]): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            // Compute the sum of the relative sizes over all the given cells
            // If they already sum to 1, there is nothing to do
            const cellSizesSum = cells.reduce((sum, cell) => sum + cell.options.relativeSize, 0);
            if (cellSizesSum === 1) {
                return;
            }

            // Otherwise, scale every size (up or down) to ensure the sizes sum to 1
            for (let cell of cells) {
                const newSize = cell.options.relativeSize / cellSizesSum;
                editor.replace(
                    cell.options.relativeSizeParameterNode.range,
                    getRelativeSizeAsString(newSize)
                );
            }
        };
    },

    createRow(layout: Layout, rowIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const nbRows = layout.nbRows;
            const rows = layout.rows;
            const isNewLastRow = rowIndex > layout.lastRow.rowIndex;
    
            // Estimate the current indent using the column in front of the \begin{gridlayout} command
            const currentIndentSize = layout.astNode.range.from.column + INDENT_SIZE;
    
            // Get the position where to insert the new row
            const insertPosition = getInsertPositionOfRow(layout, rowIndex);
    
            // Determine the size of the new row
            let rowToResize = null;
            if (nbRows > 0) {
                rowToResize = rows[MathUtils.clamp(0, rowIndex - 1, layout.lastRow.rowIndex)];
            }
    
            const newRowSize = rowToResize
                ? rowToResize.options.relativeSize / 2
                : 1;
            const newRowSizeAsString = getRelativeSizeAsString(newRowSize);
    
            // Resize another row (to make space for the new row) if required
            if (rowToResize) {
                const newSizeOfRowToResize = rowToResize.options.relativeSize - newRowSize;
                const newSizeOfRowToResizeAsString = MathUtils.round(newSizeOfRowToResize, 3).toString();
    
                const parameterNode = rowToResize.options.relativeSizeParameterNode;
                editor.addEditProviders(parameterNode.edits.setTextContent(newSizeOfRowToResizeAsString));
            }
    
            // Insert a new row with a single cell
            const indent = " ".repeat(INDENT_SIZE);
            const currentIndent = " ".repeat(currentIndentSize);
            const newRowText = [
                `${isNewLastRow ? "\n" + currentIndent : ""}`,
                `\\begin{row}{${newRowSizeAsString}}\n`,
                `${currentIndent}${indent}\\begin{cell}{1}\n`,
                `${currentIndent}${indent}${indent}~\n`,
                `${currentIndent}${indent}\\end{cell}\n`,
                `${currentIndent}\\end{row}`,
                `${!isNewLastRow ? "\n" : ""}`
            ].join("");
    
            editor.insert(insertPosition, newRowText);
        };
    },

    createCell(layout: Layout, rowIndex: number, cellIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            if (rowIndex > layout.rows.length - 1) {
                console.warn(`The grid layout's cell cannot be created: there is no row at index ${rowIndex}.`);
                return;
            }
    
            const row = layout.rows[rowIndex];
            const cells = row.cells;
            const nbCells = row.nbCells;
            const isNewLastCell = nbCells === 0 || cellIndex > row.lastCell.cellIndex;
    
            // Estimate the current indent using the column in front of the \begin{row} command
            const currentIndentSize = row.astNode.range.from.column + INDENT_SIZE;
    
            // Get the position where to insert the new cell
            const insertPosition = getInsertPositionOfCell(row, cellIndex);
    
            // Determine the size of the new cell
            let cellToResize = null;
            if (nbCells > 0) {
                cellToResize = cells[MathUtils.clamp(0, cellIndex - 1, row.lastCell.cellIndex)];
            }
    
            const newCellSize = cellToResize
                ? cellToResize.options.relativeSize / 2
                : 1;
            const newCellSizeAsString = MathUtils.round(newCellSize, 3).toString();
    
            // Resize another cell (to make space for the new cell) if required
            if (cellToResize) {
                const newSizeOfCellToResize = cellToResize.options.relativeSize - newCellSize;
                const newSizeOfCellToResizeAsString = getRelativeSizeAsString(newSizeOfCellToResize);
    
                const parameterNode = cellToResize.options.relativeSizeParameterNode;
                editor.addEditProviders(parameterNode.edits.setTextContent(newSizeOfCellToResizeAsString));
            }
    
            // Insert a new cell
            const indent = " ".repeat(INDENT_SIZE);
            const currentIndent = " ".repeat(currentIndentSize);
            const newRowText = [
                `${isNewLastCell ? "\n" + currentIndent : ""}`,
                `\\begin{cell}{${newCellSizeAsString}}\n`,
                `${currentIndent}${indent}~\n`,
                `${currentIndent}\\end{cell}`,
                `${!isNewLastCell ? "\n" : ""}`,
                `${!isNewLastCell ? currentIndent : ""}`
            ].join("");
    
            editor.insert(insertPosition, newRowText);
        };
    },

    deleteRow(layout: Layout, row: Row): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const allRowsExceptDeletedRow = layout.rows.filter(someRow => someRow !== row);

            editor.addEditProviders(row.astNode.edits.deleteTextContent()) ;
            editor.addEditProviders(this.normalizeRowSizes(allRowsExceptDeletedRow));
        };
    },

    deleteCell(layout: Layout, cell: Cell): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const row = layout.getRowAt(cell.rowIndex);
            const allRowCellsExceptDeletedCell = row.cells.filter(someCell => someCell !== cell);

            editor.addEditProviders(cell.astNode.edits.deleteTextContent()) ;
            editor.addEditProviders(this.normalizeCellSizes(allRowCellsExceptDeletedCell));
        };
    },

    moveCell(layout: Layout, cell: Cell, to: { rowIndex: number, cellIndex: number }): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            // TODO
        };
    }
};
