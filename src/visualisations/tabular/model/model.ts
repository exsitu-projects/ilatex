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
                    // console.info(`column ${oldColumnIndex} => column ${newColumnIndex}`);

                    await this.addColumn(newColumnIndex);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "add-row",
                handler: async payload => {
                    const { newRowIndex } = payload;
                    // console.info(`row ${oldRowIndex} => row ${newRowIndex}`);

                    await this.addRow(newRowIndex);
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

    private async addColumn(newColumnIndex: number): Promise<void> {
        // TODO: handle the special case of an empty grid?
        if (!this.grid) {
            return;
        }

        // TODO: add a column type BEFORE inserting the new cells

        const textInsertions: {position: SourceFilePosition, content: string}[] = [];
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

        await this.astNode.makeAtomicChangeWithinNode([
            editBuilder => textInsertions.forEach(({position, content}) => {
                editBuilder.replace(position.asVscodePosition, content);
            })
        ]);
    }

    private async addRow(newRowIndex: number): Promise<void> {
        // TODO: handle the special case of an empty grid?
        if (!this.grid) {
            return;
        }

        const rows = this.grid.rows;

        const isNewLastRow = newRowIndex > this.grid.lastRow.rowIndex;
        const insertPosition = isNewLastRow
            ? this.grid.lastRow.lastCell.range.to
            : rows[newRowIndex].cells[0].range.from;

        const nbColumnTypes = this.grid.options.columnTypes.length;
        const referenceRowForLeadingWhitespaceToInsert = rows[MathUtils.clamp(0, newRowIndex, rows.length - 1)];
        const leadingWhitespaceToInsert = (await this.sourceFile.getContent(
            new SourceFileRange(
                referenceRowForLeadingWhitespaceToInsert.cells[0].range.from,
                referenceRowForLeadingWhitespaceToInsert.cells[0].contentStart
            )
        ));
        const contentToInsert = `${leadingWhitespaceToInsert}~ ${"& ~ ".repeat(Math.max(0, nbColumnTypes - 1))}\\\\`;
        
        await this.astNode.makeAtomicChangeWithinNode([
            editBuilder => editBuilder.insert(insertPosition.asVscodePosition, contentToInsert)
        ]);
    }

    private async moveColumn(oldColumnIndex: number, newColumnIndex: number): Promise<void> {
        if (!this.grid) {
            return;
        }
        
        const rows = this.grid.rows;
        const textReplacements: {range: SourceFileRange, newContent: string}[] = [];

        // Copy the content of the cells of the origin and target columns
        const originColumnCellsContent = rows
            .map(row => row.cells[oldColumnIndex]?.textContent);

        let updateCellContentAt;
        if (oldColumnIndex > newColumnIndex) {
            // Case 1: the column is moved from right to left (<--)
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                if (columnIndex <= oldColumnIndex && columnIndex > newColumnIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex, columnIndex - 1);

                    // console.log(`About to replace ${cellToEdit.textContent} by ${cellToCopy.textContent}`);
                    // await this.replaceCellContent(cellToEdit, cellToCopy.textContent);
                    textReplacements.push({
                        range: cellToEdit.contentRange,
                        newContent: cellToCopy.textContent
                    });
                }
            };
        }
        else if (newColumnIndex > oldColumnIndex) {
            // Case 2: the column is moved from left to right (-->)
            // In this case, the content of the target column is also updated by this function
            // (for each line, it must be done first since the target cell is the rightmost edited cell)
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                let lastEditedCellContent = null;
                if (columnIndex <= newColumnIndex && columnIndex >= oldColumnIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex, columnIndex + 1);

                    const currentContent = cellToEdit.textContent;
                    const newContent = columnIndex === newColumnIndex
                                    ? originColumnCellsContent[rowIndex]
                                    : (lastEditedCellContent ?? cellToCopy.textContent);

                    // console.log(`About to replace ${cellToEdit.textContent} by ${newContent}`);
                    // await this.replaceCellContent(cellToEdit, newContent);
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
        else {
            // Case 3: the column is not moved (no cell content has to be updated)
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
        // (positions will still be correct since all the cells to edit
        // are located before all the shifted cells — provided two cells of
        // different rows are never located in the same line!)
        if (oldColumnIndex > newColumnIndex) {
            for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
                const row = rows[rowIndex];
                
                // Skip rows which do not "syntactically" span to
                // the origin/target column (the one with the highest index)
                if (row.nbCells - 1 < Math.max(oldColumnIndex, newColumnIndex)) {
                    continue;
                }
                
                // await this.replaceCellContent(
                //     row.cells[newColumnIndex],
                //     originColumnCellsContent[rowIndex]
                // );
                textReplacements.push({
                    range: row.cells[newColumnIndex].contentRange,
                    newContent: originColumnCellsContent[rowIndex]
                });
            }
        }

        await this.sourceFile.makeAtomicChange([
            editBuilder => textReplacements.forEach(({range, newContent}) => {
                editBuilder.replace(range.asVscodeRange, newContent);
            })
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
                    ${grid.options.columnTypes.map(
                        column => `<th>${column}</th>`
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