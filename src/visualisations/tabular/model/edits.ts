import { WhitespaceNode } from "../../../core/ast/nodes/WhitespaceNode";
import { AtomicSourceFileEditor, SourceFileEditProvider } from "../../../core/source-files/AtomicSourceFileEditor";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { Cell, Grid, Row } from "./Grid";

export const edits = {
    replaceCellContent(cell: Cell, newContent: string): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            editor.replace(cell.contentRange, newContent);
        };
    },

    insertColumnType(grid: Grid, columnIndex: number, columnType: string): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const options = grid.options;

            let columnTypeInsertPosition = options.columnTypesParameterNode.range.to;
            if (columnIndex === 0 && options.nbColumnSpecifications > 0) {
                columnTypeInsertPosition = options.getSpecificationRangeOfColumnWithIndex(0)!.from;
            }
            else if (options.hasSpecificationForColumnWithIndex(columnIndex - 1)) {
                columnTypeInsertPosition = options.getSpecificationRangeOfColumnWithIndex(columnIndex - 1)!.to;
            }

            editor.insert(columnTypeInsertPosition, columnType);
        };
    },

    deleteColumnType(grid: Grid, columnIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const columnTypeRange = grid.options.getSpecificationRangeOfColumnWithIndex(columnIndex);
            if (columnTypeRange) {
                editor.delete(columnTypeRange);
            }
        };
    },

    replaceColumnType(grid: Grid, columnIndex: number, newColumnType: string): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const columnTypeRange = grid.options.getSpecificationRangeOfColumnWithIndex(columnIndex);
            if (columnTypeRange) {
                editor.replace(columnTypeRange, newColumnType);
            }
        };
    },

    // TODO: handle the special case of an empty grid
    createColumn(grid: Grid, newColumnIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            // Insert a new column type at the appropriate position
            const defaultNewColumnType = "l";
            editor.addEditProviders(this.insertColumnType(grid, newColumnIndex, defaultNewColumnType));

            // In every row, insert a new cell at the appropriate position
            const rows = grid.rows;
            for (let row of rows) {
                const isNewFirstCellOfRow = newColumnIndex === 0;
                const isNewLastCellOfRow = newColumnIndex > row.lastCell.columnIndex;
                const insertPosition = isNewLastCellOfRow
                    ? row.lastCell.range.to // insert after the last cell
                    : isNewFirstCellOfRow
                        ? row.cells[newColumnIndex].contentStart // insert before the content of the 1st cell of the row
                        : row.cells[newColumnIndex].range.from; // insert before the next cell

                const leadingWhitespace = isNewFirstCellOfRow
                    ? ""
                    : isNewLastCellOfRow && row.lastCell.hasTrailingWhitespace
                        ? ""
                        : " ";
                const contentToInsert = isNewLastCellOfRow
                    ? `${leadingWhitespace}& ~ `
                    : `${leadingWhitespace}~ & `;
                
                editor.insert(insertPosition, contentToInsert);
            }
        };
    },

    // TODO: handle the special case of an empty grid
    createRow(grid: Grid, newRowIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const nbColumnTypes = grid.options.nbColumnSpecifications;
            if (nbColumnTypes === 0) {
                console.warn("No row can be added: no column type is specified.");
                return;
            }
    
            // The insert position of the new row can either be
            // - the end of the last cell of the row if it is the last row
            //   (so that it may optionally be followed by a final separator); or
            // - the start of the first cell of the next row
            //   (i.e. including leading whitespace, non-content node, etc).
            const isNewLastRow = newRowIndex > grid.lastRow.rowIndex;
            const insertPosition = isNewLastRow
                ? grid.lastRow.lastCell.range.to
                : grid.rows[newRowIndex].cells[0].range.from;
    
            // Try to determine the leading whitespace to insert before the content of the first cell of the new row
            const referenceRowForLeadingWhitespace = grid.rows[MathUtils.clamp(0, newRowIndex, grid.rows.length - 1)];
            const leadingWhitespace = referenceRowForLeadingWhitespace.firstCell.hasLeadingWhitespace
                ? await referenceRowForLeadingWhitespace.firstCell.astNodes[0].textContent
                : "";
    
            // Insert the content of the new row
            const newLeadingRowSeparator = isNewLastRow ? "\\\\" : "";
            const newTrailingRowSeparator = isNewLastRow ? "" : "\\\\";
            const contentToInsert = `${newLeadingRowSeparator}${leadingWhitespace}~ ${"& ~ ".repeat(Math.max(0, nbColumnTypes - 1))}${newTrailingRowSeparator}`;
            
            editor.insert(insertPosition, contentToInsert);
        };
    },

    deleteColumn(grid: Grid, columnIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            // Delete the appropriate column type
            editor.addEditProviders(this.deleteColumnType(grid, columnIndex));

            // In every row, delete the appropriate cell (or the entire row if it only contains one column)
            for (let row of grid.rows) {
                const cellToDelete = row.cells[columnIndex];
    
                // If the current row does not have a cell with the given column index, skip the row
                if (!cellToDelete) {
                    continue;
                }
                
                const isFirstCell = columnIndex === 0;
                const isLastCell = columnIndex === row.cells.length - 1;
    
                if (isLastCell) {
                    // 1.1. If this is the only cell of the row, simply delete the whole row
                    if (isFirstCell) {
                        editor.addEditProviders(this.deleteRow(grid, row.rowIndex));
                    }
                    // 1.2. If it not the only cell of the row, delete the cell and the preceeding separator
                    else {
                        const previousCellSeparatorStart = row.cells[columnIndex - 1].followingSeparatorNode!.range.from;
                        editor.delete(previousCellSeparatorStart.rangeTo(cellToDelete.end));
                    }
                }
                // 2. Otherwise, delete the range from the start of the cell content to
                // - the end of the leading whitespace of the next cell if there is any,
                // - the end of the separator following the cell to delete otherwise
                else {
                    const nextCell = row.cells[columnIndex + 1];
    
                    const start = cellToDelete.contentStart;    
                    const end = nextCell.hasLeadingWhitespace
                        ? nextCell.astNodes[0].range.to
                        : cellToDelete.followingSeparatorNode!.range.to;
                    editor.delete(start.rangeTo(end));
                }
            }
        }; 
    },

    deleteRow(grid: Grid, rowIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const rowToDelete = grid.rows[rowIndex];
            const isLastRow = rowIndex === grid.rows.length - 1;
            const nextRow = grid.rows[rowIndex + 1];
    
            // Delete the row with the given index from the start of the content of the first cell to
            // - the end of the following separator if it is the last row of the grid/there is no whitespace after, or
            // - the end of the whitespace following the following separator otherwise
            let endOfRangeToDelete = rowToDelete.rangeWithLastFollowingSeparator.to;
            if (!isLastRow && nextRow.firstCell.hasLeadingWhitespace) {
                endOfRangeToDelete = nextRow.firstCell.astNodes[0].range.to;
            }
            else if (isLastRow && grid.hasNodeAfterLastRow) {
                const firstNodeAfterLastRow = grid.nodesAfterLastRow[0];
                if (firstNodeAfterLastRow instanceof WhitespaceNode) {
                    endOfRangeToDelete = firstNodeAfterLastRow.range.to;
                }
            }
    
            editor.delete(new SourceFileRange(
                rowToDelete.firstCell.contentStart,
                endOfRangeToDelete
            ));
        };
    },

    moveColumn(grid: Grid, oldColumnIndex: number, newColumnIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const options = grid.options;
            const rows = grid.rows;
    
            // Copy the content of the cells of the origin and target columns
            const originColumnCellsContent = rows
                .map(row => row.cells[oldColumnIndex]?.textContent);
    
            let updateCellContentAt;
            // Case 1: the column is moved from right to left (<--)
            if (oldColumnIndex > newColumnIndex) {
                updateCellContentAt = (rowIndex: number, columnIndex: number) => {
                    if (columnIndex <= oldColumnIndex && columnIndex > newColumnIndex) {
                        const cellToEdit = grid.getCellAt(rowIndex, columnIndex);
                        const cellToCopy = grid.getCellAt(rowIndex, columnIndex - 1);
    
                        editor.replace(cellToEdit.contentRange, cellToCopy.textContent);
                    }
                };
            }
            // Case 2: the column is moved from left to right (-->)
            // In this case, the content of the target column is also updated by this function
            // (for each line, it must be done first since the target cell is the rightmost edited cell)
            else if (newColumnIndex > oldColumnIndex) {
                updateCellContentAt = (rowIndex: number, columnIndex: number) => {
                    let lastEditedCellContent = null;
                    if (columnIndex <= newColumnIndex && columnIndex >= oldColumnIndex) {
                        const cellToEdit = grid.getCellAt(rowIndex, columnIndex);
                        const cellToCopy = grid.getCellAt(rowIndex, columnIndex + 1);
    
                        const currentContent = cellToEdit.textContent;
                        const newContent = columnIndex === newColumnIndex
                                        ? originColumnCellsContent[rowIndex]
                                        : (lastEditedCellContent ?? cellToCopy.textContent);
    
                        editor.replace(cellToEdit.contentRange, newContent);
    
                        // Update the copy of the last replaced content
                        // If the last replacement in this row is done,
                        // reset the content of the last edited cell (for next row, if any)
                        lastEditedCellContent = currentContent;
                        if (columnIndex === oldColumnIndex) {
                            lastEditedCellContent = null;
                        }
                    }
                };
            }
            // Case 3: the column is not moved (no cell content has to be updated)
            else {
                return;
            }
    
            // Shift the columns between the two indices
            for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
                const row = rows[rowIndex];
    
                // Skip rows which do not "syntactically" span to
                // the origin/target column (the one with the highest index)
                if (row.nbCells - 1 < Math.max(oldColumnIndex, newColumnIndex)) {
                    continue;
                }
    
                for (let columnIndex = row.nbCells - 1; columnIndex >= 0; columnIndex--) {
                    // console.log(`Update cell at [row ${rowIndex}, column ${columnIndex}]`);
                    updateCellContentAt(rowIndex, columnIndex);
                }
            }
    
            // If the column is moved from right to left (<--),
            // the content of the target column must be finally replaced
            if (oldColumnIndex > newColumnIndex) {
                for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
                    const row = rows[rowIndex];
                    
                    // Skip rows which do not "syntactically" span to
                    // the origin/target column (the one with the highest index)
                    if (row.nbCells - 1 < Math.max(oldColumnIndex, newColumnIndex)) {
                        continue;
                    }

                    editor.replace(
                        row.cells[newColumnIndex].contentRange,
                        originColumnCellsContent[rowIndex]
                    );
                }
            }
    
            // Update the column types as well
            if (oldColumnIndex > newColumnIndex) { // <--
                for (let i = newColumnIndex + 1; i <= oldColumnIndex; i++) {
                    const newColumnType = options.getSpecificationOfColumnWithIndex(i - 1)!.text;
                    editor.addEditProviders(this.replaceColumnType(grid, i, newColumnType));
                }
            }
            else if (newColumnIndex > oldColumnIndex) { // -->
                for (let i = newColumnIndex - 1; i >= oldColumnIndex; i--) {
                    const newColumnType = options.getSpecificationOfColumnWithIndex(i + 1)!.text;
                    editor.addEditProviders(this.replaceColumnType(grid, i, newColumnType));
                }
            }

            const movedColumnType = options.getSpecificationOfColumnWithIndex(oldColumnIndex)!.text;
            editor.addEditProviders(this.replaceColumnType(grid, newColumnIndex, movedColumnType));
        };
    },

    moveRow(grid: Grid, oldRowIndex: number, newRowIndex: number): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            const rows = grid.rows;
            const textReplacements: {range: SourceFileRange, newContent: string}[] = [];
    
            // Copy the content of the cells of the origin row (before any move)
            const originRowCellsContent = rows[oldRowIndex].cells
                .map(cell => cell.textContent);
    
            let updateCellContentAt;
            // Case 1: the row is moved from bottom to top (^^^)
            if (newRowIndex < oldRowIndex) {
                updateCellContentAt = (rowIndex: number, columnIndex: number) => {
                    if (rowIndex > newRowIndex && rowIndex <= oldRowIndex) {
                        const cellToEdit = grid.getCellAt(rowIndex, columnIndex);
                        const cellToCopy = grid.getCellAt(rowIndex - 1, columnIndex);
    
                        // console.log(`About to replace ${cellToEdit.textContent} by ${cellToCopy.textContent}`);
                        editor.replace(cellToEdit.contentRange, cellToCopy.textContent);
                    }
                };
            }
            // Case 2: the row is moved from top to bottom (vvv)
            // In this case, the content of the target row is also updated by this function
            else if (newRowIndex > oldRowIndex) {
                let lastEditedRowCellContent: string[] = [];
                let currentEditedRowCellContent: string[] = [];
    
                updateCellContentAt = (rowIndex: number, columnIndex: number) => {
                    if (rowIndex >= oldRowIndex && rowIndex <= newRowIndex) {
                        // Before starting to edit a new row, make a copy of its content
                        // and of the content of the previously edited row (if any)
                        if (columnIndex === rows[rowIndex].nbCells - 1) {
                            lastEditedRowCellContent = currentEditedRowCellContent;
                            currentEditedRowCellContent = rows[rowIndex].cells
                                .map(cell => cell.textContent);
                        }
    
                        // Edit the content of the cell
                        // If this is the last row to edit (i.e. the target row),
                        // use the content of the origin row (instead of the content of the row below)
                        const cellToEdit = grid.getCellAt(rowIndex, columnIndex);
                        const newContent = rowIndex === newRowIndex
                                            ? originRowCellsContent[columnIndex]
                                            : lastEditedRowCellContent[columnIndex];
    
                        // console.log(`About to replace ${cellToEdit.textContent} by ${newContent}`);
                        editor.replace(cellToEdit.contentRange, newContent);
                    }
                };
            }
            // Case 3: the row is not moved (no cell content has to be updated)
            else {
                return;
            }
    
            // Shift the rows between the two indices
            const highestRowIndex = Math.max(oldRowIndex, newRowIndex);
            const minRowIndex = Math.min(oldRowIndex, newRowIndex);
            for (let rowIndex = highestRowIndex; rowIndex >= minRowIndex; rowIndex--) {
                const row = rows[rowIndex];
    
                for (let columnIndex = row.nbCells - 1; columnIndex >= 0; columnIndex--) {
                    // console.log(`Update cell at [row ${rowIndex}, column ${columnIndex}]`);
                    updateCellContentAt(rowIndex, columnIndex);
                }
            }
    
            // If the row is moved from bottom to top (^^^),
            // the content of the target row must be finally replaced
            if (newRowIndex < oldRowIndex) {
                // Assume the origin and the target rows have the same number of cells (as assumed everywhere else)
                for (let columnIndex = originRowCellsContent.length - 1; columnIndex >= 0; columnIndex--) {
                    editor.replace(
                        rows[newRowIndex].cells[columnIndex].contentRange,
                        originRowCellsContent[columnIndex]
                    );
                }
            }
        };
    }
};
