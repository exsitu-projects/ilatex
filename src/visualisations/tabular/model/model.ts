import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Grid, Row } from "./Grid";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";
import { SourceFilePosition } from "../../../core/source-files/SourceFilePosition";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { WhitespaceNode } from "../../../core/ast/nodes/WhitespaceNode";


export class NoGridError {}


export class TabularVisualisationModel extends AbstractVisualisationModel<EnvironmentNode> {
    readonly name = "tabular";
    private grid: Grid | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: VisualisationModelUtilities) {
        super(context, utilities);
        this.grid = null;
    }

    protected get contentDataAsHtml(): string {
        return this.grid
            ? TabularVisualisationModel.renderGridAsHTML(this.grid)
            : "";
   }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "select-cell-content",
                handler: async payload => {
                    const { rowIndex, columnIndex } = payload;
                    const cell = this.getCellAt(rowIndex, columnIndex);
                    
                    await this.selectCellContent(cell);
                }
            },
            {
                title: "set-cell-content",
                handler: async payload => {
                    const { rowIndex, columnIndex, newContent } = payload;
                    const cell = this.getCellAt(rowIndex, columnIndex);

                    await this.replaceCellContent(cell, newContent);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "add-column",
                handler: async payload => {
                    const { newColumnIndex } = payload;

                    await this.addColumn(newColumnIndex);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "add-row",
                handler: async payload => {
                    const { newRowIndex } = payload;

                    await this.addRow(newRowIndex);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "delete-column",
                handler: async payload => {
                    const { columnIndex } = payload;

                    await this.deleteColumn(columnIndex);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "delete-row",
                handler: async payload => {
                    const { rowIndex } = payload;

                    await this.deleteRow(rowIndex);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "move-column",
                handler: async payload => {
                    const { oldColumnIndex, newColumnIndex } = payload;
                    // console.info(`column ${oldColumnIndex} => column ${newColumnIndex}`);

                    await this.moveColumn(oldColumnIndex, newColumnIndex);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "move-row",
                handler: async payload => {
                    const { oldRowIndex, newRowIndex } = payload;
                    // console.info(`row ${oldRowIndex} => row ${newRowIndex}`);

                    await this.moveRow(oldRowIndex, newRowIndex);
                    this.registerChangeRequestedByTheView();
                }
            }
        ];
    }

    private getCellAt(rowIndex: number, columnIndex: number): Cell {
        if (!this.grid) {
            throw new NoGridError();
        }

        return this.grid.rows[rowIndex].cells[columnIndex];
    }

    private async selectCellContent(cell: Cell): Promise<void> {
        await this.sourceFile.selectRangeInEditor(cell.contentRange);
    }

    private async replaceCellContent(cell: Cell, newContent: string): Promise<void> {
        await this.astNode.makeAtomicChangeWithinNode([
            editBuilder => editBuilder.replace(cell.contentRange.asVscodeRange, newContent)
        ]);
    }

    private insertColumnType(columnIndex: number, columnType: string, editBuilder: vscode.TextEditorEdit): void {
        if (!this.grid) {
            return;
        }
        
        const options = this.grid.options;
        let columnTypeInsertPosition = options.columnTypesParameterNode.range.to;
        if (columnIndex === 0 && options.nbColumnSpecifications > 0) {
            columnTypeInsertPosition = options.getSpecificationRangeOfColumnWithIndex(0)!.from;
        }
        else if (options.hasSpecificationForColumnWithIndex(columnIndex - 1)) {
            columnTypeInsertPosition = options.getSpecificationRangeOfColumnWithIndex(columnIndex - 1)!.to;
        }

        editBuilder.insert(columnTypeInsertPosition.asVscodePosition, columnType);
    }

    private deleteColumnType(columnIndex: number, editBuilder: vscode.TextEditorEdit): void {
        if (!this.grid) {
            return;
        }
        
        const options = this.grid.options;
        const columnTypeRange = options.getSpecificationRangeOfColumnWithIndex(columnIndex);
        if (columnTypeRange) {
            editBuilder.delete(columnTypeRange.asVscodeRange);
        }
    }

    private replaceColumnType(columnIndex: number, newColumnType: string, editBuilder: vscode.TextEditorEdit): void {
        if (!this.grid) {
            return;
        }
        
        const options = this.grid.options;
        const columnTypeRange = options.getSpecificationRangeOfColumnWithIndex(columnIndex);
        if (columnTypeRange) {
            editBuilder.replace(columnTypeRange.asVscodeRange, newColumnType);
        }
    }

    private async addColumn(newColumnIndex: number, editBuilder?: vscode.TextEditorEdit): Promise<void> {
        // TODO: handle the special case of an empty grid?
        if (!this.grid) {
            return;
        }
        
        const textInsertions: {position: SourceFilePosition, content: string}[] = [];
        
        // In every row, insert a new cell at the appropriate position
        const rows = this.grid.rows;
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
            
            textInsertions.push({
                position: insertPosition,
                content: contentToInsert
            });
        }
        
        // Define and apply the edit function
        const applyEdit = (editBuilder: vscode.TextEditorEdit) => {
            // Add new cells
            for (let {position, content} of textInsertions) {
                editBuilder.replace(position.asVscodePosition, content);
            }

            // Also insert a new column type at the appropriate position
            const defaultNewColumnType = "l";
            this.insertColumnType(newColumnIndex, defaultNewColumnType, editBuilder);
        };

        if (editBuilder) {
            applyEdit(editBuilder);
        }
        else {
            await this.astNode.makeAtomicChangeWithinNode([applyEdit]);
        }
    }

    private async addRow(newRowIndex: number, editBuilder?: vscode.TextEditorEdit): Promise<void> {
        // TODO: handle the special case of an empty grid?
        if (!this.grid) {
            return;
        }

        const nbColumnTypes = this.grid.options.nbColumnSpecifications;
        if (nbColumnTypes === 0) {
            console.warn("No row can be added: no column type is specified.");
            return;
        }

        const rows = this.grid.rows;

        // The insert position of the new row can either be
        // - the end of the last cell of the row if it is the last row
        //   (so that it may optionally be followed by a final separator); or
        // - the start of the first cell of the next row
        //   (i.e. including leading whitespace, non-content node, etc).
        const isNewLastRow = newRowIndex > this.grid.lastRow.rowIndex;
        const insertPosition = isNewLastRow
            ? this.grid.lastRow.lastCell.range.to
            : rows[newRowIndex].cells[0].range.from;

        // Try to determine the leading whitespace to insert before the content of the first cell of the new row
        const referenceRowForLeadingWhitespace = rows[MathUtils.clamp(0, newRowIndex, rows.length - 1)];
        const leadingWhitespace = referenceRowForLeadingWhitespace.firstCell.hasLeadingWhitespace
            ? await this.sourceFile.getContent(referenceRowForLeadingWhitespace.firstCell.astNodes[0].range)
            : "";

        // Only insert a leading row separator if the new row is the new last row
        const newLeadingRowSeparator = isNewLastRow ? "\\\\" : "";

        // Only insert a trailing row separator if the new row is not the new last row
        const newTrailingRowSeparator = isNewLastRow ? "" : "\\\\";
        
        const contentToInsert = `${newLeadingRowSeparator}${leadingWhitespace}~ ${"& ~ ".repeat(Math.max(0, nbColumnTypes - 1))}${newTrailingRowSeparator}`;
        
        // Define and apply the edit function
        const applyEdit = (editBuilder: vscode.TextEditorEdit) => editBuilder.insert(insertPosition.asVscodePosition, contentToInsert);

        if (editBuilder) {
            applyEdit(editBuilder);
        }
        else {
            await this.astNode.makeAtomicChangeWithinNode([applyEdit]);
        }
    }

    private async deleteColumn(columnIndex: number, editBuilder?: vscode.TextEditorEdit): Promise<void> {
        if (!this.grid) {
            return;
        }

        const rangesToDelete: SourceFileRange[] = [];
        const rowsToDelete: Row[] = [];

        // In every row, delete the appropriate cell (or the entire row if it only contains one column)
        const rows = this.grid.rows;
        for (let row of rows) {
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
                    rowsToDelete.push(row);
                }
                // 1.2. If it not the only cell of the row, delete the cell and the preceeding separator
                else {
                    const previousCellSeparatorStart = row.cells[columnIndex - 1].followingSeparatorNode!.range.from;
                    rangesToDelete.push(previousCellSeparatorStart.rangeTo(cellToDelete.end));
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
                rangesToDelete.push(new SourceFileRange(start, end));
            }
        }

        // Define and apply the edit function
        const applyEdit = (editBuilder: vscode.TextEditorEdit) => {
            rangesToDelete.forEach(range => editBuilder.delete(range.asVscodeRange));
            rowsToDelete.forEach(row => this.deleteRow(row.rowIndex, editBuilder));

            // Also delete the appropriate column type
            this.deleteColumnType(columnIndex, editBuilder);
        };

        if (editBuilder) {
            applyEdit(editBuilder);
        }
        else {
            await this.astNode.makeAtomicChangeWithinNode([applyEdit]);
        }
    }

    private async deleteRow(rowIndex: number, editBuilder?: vscode.TextEditorEdit): Promise<void> {
        if (!this.grid) {
            return;
        }

        const rows = this.grid.rows;
        const rowToDelete = this.grid.rows[rowIndex];

        if (!rowToDelete) {
            console.warn(`The row cannot be deleted: there is no row with index ${rowIndex}.`);
            return;
        }
        
        const isLastRow = rowIndex === rows.length - 1;
        const nextRow = rows[rowIndex + 1];

        // Delete the row with the given index from the start of the content of the first cell to
        // - the end of the following separator if it is the last row of the grid/there is no whitespace after, or
        // - the end of the whitespace following the following separator otherwise
        let endOfRangeToDelete = rowToDelete.rangeWithLastFollowingSeparator.to;
        if (!isLastRow && nextRow.firstCell.hasLeadingWhitespace) {
            endOfRangeToDelete = nextRow.firstCell.astNodes[0].range.to;
        }
        else if (isLastRow && this.grid.hasNodeAfterLastRow) {
            const firstNodeAfterLastRow = this.grid.nodesAfterLastRow[0];
            if (firstNodeAfterLastRow instanceof WhitespaceNode) {
                endOfRangeToDelete = firstNodeAfterLastRow.range.to;
            }
        }

        const rangeToDelete = new SourceFileRange(
            rowToDelete.firstCell.contentStart,
            endOfRangeToDelete
        );

        // Define and apply the edit function
        const applyEdit = (editBuilder: vscode.TextEditorEdit) => editBuilder.delete(rangeToDelete.asVscodeRange);

        if (editBuilder) {
            applyEdit(editBuilder);
        }
        else {
            await this.astNode.makeAtomicChangeWithinNode([applyEdit]);
        }
    }

    private async moveColumn(oldColumnIndex: number, newColumnIndex: number): Promise<void> {
        if (!this.grid) {
            return;
        }
        
        const options = this.grid.options;
        const rows = this.grid.rows;
        const textReplacements: {range: SourceFileRange, newContent: string}[] = [];
        const columnTypeReplacements: {columnIndex: number, newColumnType: string}[] = [];

        // Copy the content of the cells of the origin and target columns
        const originColumnCellsContent = rows
            .map(row => row.cells[oldColumnIndex]?.textContent);

        let updateCellContentAt;
        // Case 1: the column is moved from right to left (<--)
        if (oldColumnIndex > newColumnIndex) {
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                if (columnIndex <= oldColumnIndex && columnIndex > newColumnIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex, columnIndex - 1);

                    textReplacements.push({
                        range: cellToEdit.contentRange,
                        newContent: cellToCopy.textContent
                    });
                }
            };
        }
        // Case 2: the column is moved from left to right (-->)
        // In this case, the content of the target column is also updated by this function
        // (for each line, it must be done first since the target cell is the rightmost edited cell)
        else if (newColumnIndex > oldColumnIndex) {
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                let lastEditedCellContent = null;
                if (columnIndex <= newColumnIndex && columnIndex >= oldColumnIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex, columnIndex + 1);

                    const currentContent = cellToEdit.textContent;
                    const newContent = columnIndex === newColumnIndex
                                    ? originColumnCellsContent[rowIndex]
                                    : (lastEditedCellContent ?? cellToCopy.textContent);

                    textReplacements.push({
                        range: cellToEdit.contentRange,
                        newContent: newContent
                    });

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

            // Skip rows which do not "syntaxically" span to
            // the origin/target column (the one with the highest index)
            if (row.nbCells - 1 < Math.max(oldColumnIndex, newColumnIndex)) {
                continue;
            }

            for (let columnIndex = row.nbCells - 1; columnIndex >= 0; columnIndex--) {
                // console.log(`Update cell at [row ${rowIndex}, column ${columnIndex}]`);
                await updateCellContentAt(rowIndex, columnIndex);
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
                
                textReplacements.push({
                    range: row.cells[newColumnIndex].contentRange,
                    newContent: originColumnCellsContent[rowIndex]
                });
            }
        }

        // Update the column types as well
        if (oldColumnIndex > newColumnIndex) { // <--
            const movedColumnType = options.getSpecificationOfColumnWithIndex(oldColumnIndex)!.text;

            for (let i = newColumnIndex + 1; i <= oldColumnIndex; i++) {
                columnTypeReplacements.push({
                    columnIndex: i,
                    newColumnType: options.getSpecificationOfColumnWithIndex(i - 1)!.text
                });
            }

            columnTypeReplacements.push({
                columnIndex: newColumnIndex,
                newColumnType: movedColumnType
            });
        }
        else if (newColumnIndex > oldColumnIndex) { // -->
            const movedColumnType = options.getSpecificationOfColumnWithIndex(oldColumnIndex)!.text;

            for (let i = newColumnIndex - 1; i >= oldColumnIndex; i--) {
                columnTypeReplacements.push({
                    columnIndex: i,
                    newColumnType: options.getSpecificationOfColumnWithIndex(i + 1)!.text
                });
            }

            columnTypeReplacements.push({
                columnIndex: newColumnIndex,
                newColumnType: movedColumnType
            });
        }

        await this.sourceFile.makeAtomicChange([
            editBuilder => {
                // Replace the content of the shifted/moved cells
                for (let {range, newContent} of textReplacements) {
                    editBuilder.replace(range.asVscodeRange, newContent);
                }

                // Replace the column types of the shifted/moved columns
                for (let {columnIndex, newColumnType} of columnTypeReplacements) {
                    this.replaceColumnType(columnIndex, newColumnType, editBuilder);
                }
            }
        ]);
    }

    private async moveRow(oldRowIndex: number, newRowIndex: number): Promise<void> {
        if (!this.grid) {
            return;
        }

        const rows = this.grid.rows;
        const textReplacements: {range: SourceFileRange, newContent: string}[] = [];

        // Copy the content of the cells of the origin row (before any move)
        const originRowCellsContent = rows[oldRowIndex].cells
            .map(cell => cell.textContent);

        let updateCellContentAt;
        // Case 1: the row is moved from bottom to top (^^^)
        if (newRowIndex < oldRowIndex) {
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                if (rowIndex > newRowIndex && rowIndex <= oldRowIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex - 1, columnIndex);

                    // console.log(`About to replace ${cellToEdit.textContent} by ${cellToCopy.textContent}`);
                    // await this.replaceCellContent(cellToEdit, cellToCopy.textContent);
                    textReplacements.push({
                        range: cellToEdit.contentRange,
                        newContent: cellToCopy.textContent
                    });
                }
            };
        }
        // Case 2: the row is moved from top to bottom (vvv)
        // In this case, the content of the target row is also updated by this function
        else if (newRowIndex > oldRowIndex) {
            let lastEditedRowCellContent: string[] = [];
            let currentEditedRowCellContent: string[] = [];

            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
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
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const newContent = rowIndex === newRowIndex
                                        ? originRowCellsContent[columnIndex]
                                        : lastEditedRowCellContent[columnIndex];

                    // console.log(`About to replace ${cellToEdit.textContent} by ${newContent}`);
                    // await this.replaceCellContent(cellToEdit, newContent);
                    textReplacements.push({
                        range: cellToEdit.contentRange,
                        newContent: newContent
                    });
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
                await updateCellContentAt(rowIndex, columnIndex);
            }
        }

        // If the row is moved from bottom to top (^^^),
        // the content of the target row must be finally replaced
        // (positions will still be correct since all the cells to edit
        // are located before all the shifted cells — provided two cells of
        // different rows are never located in the same line!)
        if (newRowIndex < oldRowIndex) {
            // Assume the origin and the target rows have the same number of cells
            // (as it is assumed everywhere else)
            for (let columnIndex = originRowCellsContent.length - 1; columnIndex >= 0; columnIndex--) {
                const row = rows[newRowIndex];
                // await this.replaceCellContent(
                //     row.cells[columnIndex],
                //     originRowCellsContent[columnIndex]
                // );
                textReplacements.push({
                    range: row.cells[columnIndex].contentRange,
                    newContent: originRowCellsContent[columnIndex]
                });
            }
        }

        await this.astNode.makeAtomicChangeWithinNode([
            editBuilder => textReplacements.forEach(({range, newContent}) => {
                editBuilder.replace(range.asVscodeRange, newContent);
            })
        ]);
    }

    protected async updateContentData(): Promise<void> {
        try {
            this.grid = await Grid.from(this.astNode);
            console.log("New grid model:", this.grid);

            this.contentUpdateEndEventEmitter.fire(true);
        }
        catch (error) {
            console.log(`The content data update of the visualisation with UID ${this.uid} (${this.name}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);

        }
    }

    private static renderCellAsHTML(cell: Cell): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "data-row": cell.rowIndex.toString(),
            "data-column": cell.columnIndex.toString()
        });

        return `<td ${attributes}>${cell.textContent}</td>`;
    }

    private static renderRowAsHTML(row: Row): string {
        return `
            <tr>
                ${row.cells.map(cell => TabularVisualisationModel.renderCellAsHTML(cell)).join("\n")}
            </tr>
        `;
    }

    protected static renderGridAsHTML(grid: Grid): string {
        return `
            <table>
                <thead>
                    ${grid.options.columnSpecifications.map(
                        column => `<th data-alignement="${column.alignment.toLowerCase()}">${column.text}</th>`
                    ).join("\n")}
                </thead>
                <tbody>
                    ${grid.rows.map(
                        TabularVisualisationModel.renderRowAsHTML
                    ).join("\n")}
                </tbody>
            </table>
        `;
    }
}