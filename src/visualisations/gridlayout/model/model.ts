import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Layout, Row } from "./Layout";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { LightweightSourceFileEditor } from "../../../core/source-files/LightweightSourceFileEditor";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { edits } from "./edits";

export function getRelativeSizeAsString(relativeSize: number): string {
    return MathUtils.round(relativeSize, 3).toString();
}

function nameLightweightEditorSectionAfterCell(cell: Cell) {
    return `${cell.rowIndex}-${cell.cellIndex}`;
}

function nameLightweightEditorSectionAfterRow(row: Row) {
    return `${row.rowIndex}`;
}

class NoLayoutError {}
class NoRowError {}

export class GridLayoutModel extends AbstractVisualisationModel<EnvironmentNode> {
    readonly name = "grid layout";
    private layout: Layout | null;

    private lightweightCellSizeEditor: LightweightSourceFileEditor | null;
    private lightweightRowSizeEditor: LightweightSourceFileEditor | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: VisualisationModelUtilities) {
        super(context, utilities);
        this.layout = null;

        this.lightweightCellSizeEditor = null;
        this.lightweightRowSizeEditor = null;
    }

    protected get contentDataAsHtml(): string {
        return this.layout
            ? GridLayoutModel.rendeLayoutAsHtml(this.layout)
            : "";
    }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "select-cell-content",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;
                    await this.selectCellContent(rowIndex, cellIndex);
                }
            },
            {
                title: "create-row",
                handler: async payload => {
                    const { rowIndex } = payload;
                    await this.createRow(rowIndex);
                }
            },
            {
                title: "create-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;
                    await this.createCell(rowIndex, cellIndex);
                }
            },
            {
                title: "move-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex, targetRowIndex, targetCellIndex } = payload;
                    await this.moveCell(
                        { rowIndex: rowIndex, cellIndex: cellIndex },
                        { rowIndex: targetRowIndex, cellIndex: targetCellIndex }
                    );
                }
            },
            {
                title: "delete-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;
                    await this.deleteCell(rowIndex, cellIndex);
                }
            },
            {
                title: "resize-cells",
                handler: async payload => {
                    const { leftCellChange, rightCellChange, isFinalSize } = payload;
                    await this.updateCellSizes(
                        [leftCellChange, rightCellChange],
                        isFinalSize
                    );
                }
            },
            {
                title: "resize-rows",
                handler: async payload => {
                    const { rowAboveChange, rowBelowChange, isFinalSize } = payload;
                    await this.updateRowSizes(
                        [rowAboveChange, rowBelowChange],
                        isFinalSize
                    );
                }
            },
        ];
    }

    private async applyWithLayoutOrIgnore(
        action: (layout: Layout) => Promise<void>,
        registerAsChangeRequestedByTheView: boolean = true
    ): Promise<void> {
        if (!this.layout) {
            return;
        }

        await action(this.layout);
        if (registerAsChangeRequestedByTheView) {
            this.registerChangeRequestedByTheView();   
        }
    }

    private async selectCellContent(rowIndex: number, cellIndex: number): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
            const cell = layout.getCellAt(rowIndex, cellIndex);
            await cell.astNode.selectRangeInEditor();
        }, false);
    }

    private async createRow(rowIndex: number): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.createRow(layout, rowIndex)
            ]);
        });
    }

    private async createCell(rowIndex: number, cellIndex: number): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.createCell(layout, rowIndex, cellIndex)
            ]);
        });
    }

    private async moveCell(
        from: { rowIndex: number, cellIndex: number },
        to: { rowIndex: number, cellIndex: number }
    ): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
            const cell = layout.getCellAt(from.rowIndex, from.cellIndex);
            await this.astNode.applyEditsWithoutReparsing([
                edits.moveCell(layout, cell, to)
            ]);
        });
    }

    private async deleteCell(rowIndex: number, cellIndex: number): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
            // If the row only contains one cell, delete the row instead
            const row = layout.getRowAt(rowIndex);
            if (row.nbCells <= 1) {
                await this.astNode.applyEditsWithoutReparsing([
                    edits.deleteRow(layout, row)
                ]);
            }
            else {
                const cell = layout.getCellAt(rowIndex, cellIndex);
                await this.astNode.applyEditsWithoutReparsing([
                    edits.deleteCell(layout, cell)
                ]);
            }
        });
    }

    // private getRowInsertPosition(rowIndex: number): SourceFilePosition {
    //     if (!this.layout) {
    //         throw new NoLayoutError();
    //     }

    //     const nbRows = this.layout.nbRows;
    //     const isNewLastRow = rowIndex > this.layout.lastRow.rowIndex;

    //     // A new row should be inserted
    //     // - at the start of the env. body if the index is 0 and there is no row, or
    //     // - before the row with the given index if there is one, or
    //     // - at the end of the last row if the index is greater than its row index
    //     if (nbRows > 0) {
    //         return isNewLastRow
    //             ? this.layout.lastRow.astNode.range.to
    //             : this.layout.rows[rowIndex].astNode.range.from;
    //     }

    //     return this.astNode.body.range.from;
    // }

    // private getCellInsertPosition(row: Row, cellIndex: number): SourceFilePosition {
    //     const nbCells = row.nbCells;
    //     const isNewLastCell = nbCells === 0 || cellIndex > row.lastCell.cellIndex;

    //     // A new cell should be inserted
    //     // - at the start of the row body if the index is 0 and there is no cell, or
    //     // - before the cell with the given index if there is one, or
    //     // - at the end of the last cell if the index is greater than its cell index
    //     if (nbCells > 0) {
    //         return isNewLastCell
    //             ? row.lastCell.astNode.range.to
    //             : row.cells[cellIndex].astNode.range.from;
    //     }

    //     return row.astNode.body.range.from;
    // }

    // private getRelativeSizeAsString(relativeSize: number): string {
    //     return MathUtils.round(relativeSize, 3).toString();
    // }

    // private getRowRelativeSizesSum(): number {
    //     if (!this.layout) {
    //         throw new NoLayoutError();
    //     }

    //     return this.layout.rows.reduce(
    //         (sum, row) => sum + row.options.relativeSize,
    //         0
    //     );
    // }

    // private getCellRelativeSizesSum(row: Row): number {
    //     return row.cells.reduce(
    //         (sum, cell) => sum + cell.options.relativeSize,
    //         0
    //     );
    // }

    // private async normalizeRowSizes(rows: Row[], editBuilder?: vscode.TextEditorEdit): Promise<void> {
    //     if (!this.layout) {
    //         throw new NoLayoutError();
    //     }

    //     // Compute the sum of the relative sizes over all the given rows
    //     // If they already sum to 1, there is nothing to do
    //     const rowSizesSum = rows.reduce((sum, row) => sum + row.options.relativeSize, 0);

    //     if (rowSizesSum === 1) {
    //         return;
    //     }

    //     // Otherwise, scale every size (up or down) to ensure the sizes sum to 1
    //     const scaleRowSizes = (editBuilder: vscode.TextEditorEdit) => {
    //         for (let row of rows) {
    //             const newSize = row.options.relativeSize / rowSizesSum;
    //             editBuilder.replace(
    //                 row.options.relativeSizeParameterNode.range.asVscodeRange,
    //                 this.getRelativeSizeAsString(newSize)
    //             );
    //         }
    //     };

    //     if (editBuilder) {
    //         scaleRowSizes(editBuilder);
    //     }
    //     else {
    //         this.sourceFile.makeAtomicChange(editBuilder => scaleRowSizes(editBuilder));
    //     }
    // }

    // private async normalizeCellSizes(cells: Cell[], editBuilder?: vscode.TextEditorEdit): Promise<void> {
    //     // Compute the sum of the relative sizes over all the given cells
    //     // If they already sum to 1, there is nothing to do
    //     const cellSizesSum = cells.reduce((sum, cell) => sum + cell.options.relativeSize, 0);
    //     if (cellSizesSum === 1) {
    //         return;
    //     }

    //     // Otherwise, scale every size (up or down) to ensure the sizes sum to 1
    //     const scaleCellSizes = (editBuilder: vscode.TextEditorEdit) => {
    //         for (let cell of cells) {
    //             const newSize = cell.options.relativeSize / cellSizesSum;
    //             editBuilder.replace(
    //                 cell.options.relativeSizeParameterNode.range.asVscodeRange,
    //                 this.getRelativeSizeAsString(newSize)
    //             );
    //         }
    //     };

    //     if (editBuilder) {
    //         scaleCellSizes(editBuilder);
    //     }
    //     else {
    //         this.sourceFile.makeAtomicChange(editBuilder => scaleCellSizes(editBuilder));
    //     }
    // }

    private async updateCellSizes(
        updates: { cellIndex: number, rowIndex: number, newRelativeSize: number}[],
        isFinalUpdate: boolean
    ): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
           // Get every cell to update, as well as some additional data required to update its relative size
            const cellUpdateData = updates.map(({ cellIndex, rowIndex, newRelativeSize }) => {
                const cell = layout.getCellAt(rowIndex, cellIndex);
                return {
                    cell: cell,
                    name: nameLightweightEditorSectionAfterCell(cell),
                    range: cell.options.relativeSizeParameterNode.range,
                    newRelativeSize: newRelativeSize
                };
            });

            // Create and initialise a lightweight editor for cell sizes if there isn't any
            if (!this.lightweightCellSizeEditor) {
                this.lightweightCellSizeEditor = this.sourceFile.createLightweightEditorFor(cellUpdateData);
                await this.lightweightCellSizeEditor.init();
            }
            
            // Update the size of the cells
            const lightweightEditor = this.lightweightCellSizeEditor!;

            for (let { cell, newRelativeSize } of cellUpdateData) {
                await lightweightEditor.replaceSectionContent(
                    nameLightweightEditorSectionAfterCell(cell),
                    getRelativeSizeAsString(newRelativeSize)
                );
            }

            if (isFinalUpdate) {
                await lightweightEditor.applyChange();
                this.lightweightCellSizeEditor = null;
            } 
        });
    }


    private async updateRowSizes(
        updates: { rowIndex: number, newRelativeSize: number}[],
        isFinalUpdate: boolean
    ): Promise<void> {
        await this.applyWithLayoutOrIgnore(async (layout: Layout) => {
            // Get every row to update, as well as some additional data required to update its relative size
            const rowUpdateData = updates.map(({ rowIndex, newRelativeSize }) => {
                const row = layout.getRowAt(rowIndex);
                return {
                    row: row,
                    name: nameLightweightEditorSectionAfterRow(row),
                    range: row.options.relativeSizeParameterNode.range,
                    newRelativeSize: newRelativeSize
                };
            });

            // Create and initialise a lightweight editor for row sizes if there isn't any
            if (!this.lightweightRowSizeEditor) {
                this.lightweightRowSizeEditor = this.sourceFile.createLightweightEditorFor(rowUpdateData);
                await this.lightweightRowSizeEditor.init();
            }
            
            // Update the size of the cells
            const lightweightEditor = this.lightweightRowSizeEditor!;

            for (let { row, newRelativeSize } of rowUpdateData) {
                await lightweightEditor.replaceSectionContent(
                    nameLightweightEditorSectionAfterRow(row),
                    getRelativeSizeAsString(newRelativeSize)
                );
            }

            if (isFinalUpdate) {
                await lightweightEditor.applyChange();
                this.lightweightRowSizeEditor = null;
            }
        });
    }

    // private async resizeCells(sortedChanges: { cell: Cell, newRelativeSize: number}[], isFinalSize: boolean): Promise<void> {
    //     // Associate a unique editable section name to each cell
    //     const nameLightweightEditorSectionAfterCell = (cell: Cell) => `${cell.rowIndex}-${cell.cellIndex}`;

    //     if (!this.lightweightCellSizeEditor) {
    //         const editableSections = sortedChanges.map(change => {
    //             return {
    //                 name: nameSectionAfterCell(change.cell),
    //                 range: change.cell.options.relativeSizeParameterNode.range
    //             };
    //         });

    //         this.lightweightCellSizeEditor = this.sourceFile.createLightweightEditorFor(editableSections);
    //         await this.lightweightCellSizeEditor.init();
    //     }
        
    //     for (let change of sortedChanges) {
    //         await this.lightweightCellSizeEditor.replaceSectionContent(
    //             nameSectionAfterCell(change.cell),
    //             getRelativeSizeAsString(change.newRelativeSize)
    //         );
    //     }

    //     if (isFinalSize) {
    //         await this.lightweightCellSizeEditor.applyChange();
    //         this.lightweightCellSizeEditor = null;
    //     }
    // }

    // private async resizeRows(sortedChanges: { row: Row, newRelativeSize: number}[], isFinalSize: boolean): Promise<void> {
    //     // Associate a unique editable section name to each row
    //     const nameSectionAfterRow = (row: Row) => `${row.rowIndex}`;

    //     if (!this.lightweightRowSizeEditor) {
    //         const editableSections = sortedChanges.map(change => {
    //             return {
    //                 name: nameSectionAfterRow(change.row),
    //                 range: change.row.options.relativeSizeParameterNode.range
    //             };
    //         });

    //         this.lightweightRowSizeEditor = this.sourceFile.createLightweightEditorFor(editableSections);
    //         await this.lightweightRowSizeEditor.init();
    //     }
        
    //     for (let change of sortedChanges) {
    //         await this.lightweightRowSizeEditor.replaceSectionContent(
    //             nameSectionAfterRow(change.row),
    //             getRelativeSizeAsString(change.newRelativeSize)
    //         );
    //     }

    //     if (isFinalSize) {
    //         await this.lightweightRowSizeEditor.applyChange();
    //         this.lightweightRowSizeEditor = null;
    //     }
    // }

    // private async createRowAt(rowIndex: number): Promise<void> {
    //     if (!this.layout) {
    //         return;
    //     }

    //     console.info("=== Insert new row at: ", rowIndex);
    //     console.log(this.layout);

    //     const nbRows = this.layout.nbRows;
    //     const rows = this.layout.rows;
    //     const isNewLastRow = rowIndex > this.layout.lastRow.rowIndex;

    //     // Estimate the current indent using the column in front of the \begin{gridlayout} command
    //     const currentIndentSize = this.astNode.range.from.column + this.indentSize;

    //     // Get the position where to insert the new row
    //     const insertPosition = this.getRowInsertPosition(rowIndex);

    //     // Determine the size of the new row
    //     let rowToResize = null;
    //     if (nbRows > 0) {
    //         rowToResize = rows[MathUtils.clamp(0, rowIndex - 1, this.layout.lastRow.rowIndex)];
    //     }

    //     const newRowSize = rowToResize
    //         ? rowToResize.options.relativeSize / 2
    //         : 1;
    //     const newRowSizeAsString = this.getRelativeSizeAsString(newRowSize);

    //     // Resize another row (to make space for the new row) if required
    //     if (rowToResize) {
    //         const newSizeOfRowToResize = rowToResize.options.relativeSize - newRowSize;
    //         const newSizeOfRowToResizeAsString = MathUtils.round(newSizeOfRowToResize, 3).toString();

    //         await rowToResize.options.relativeSizeParameterNode.setTextContent(newSizeOfRowToResizeAsString);
    //     }

    //     // Insert a new row with a single cell
    //     const indent = " ".repeat(this.indentSize);
    //     const currentIndent = " ".repeat(currentIndentSize);
    //     const newRowText = [
    //         `${isNewLastRow ? "\n" + currentIndent : ""}`,
    //         `\\begin{row}{${newRowSizeAsString}}\n`,
    //         `${currentIndent}${indent}\\begin{cell}{1}\n`,
    //         `${currentIndent}${indent}${indent}~\n`,
    //         `${currentIndent}${indent}\\end{cell}\n`,
    //         `${currentIndent}\\end{row}`,
    //         `${!isNewLastRow ? "\n" : ""}`
    //     ].join("");

    //     await this.sourceFile.makeAtomicChange(editBuilder => 
    //         editBuilder.insert(insertPosition.asVscodePosition, newRowText)
    //     );
    // }

    // private async createCellAt(rowIndex: number, cellIndex: number): Promise<void> {
    //     if (!this.layout) {
    //         return;
    //     }

    //     if (rowIndex > this.layout.rows.length - 1) {
    //         console.warn(`The grid layout's cell cannot be created: there is no row at index ${rowIndex}.`);
    //         return;
    //     }

    //     const row = this.layout.rows[rowIndex];
    //     const cells = row.cells;
    //     const nbCells = row.nbCells;
    //     const isNewLastCell = nbCells === 0 || cellIndex > row.lastCell.cellIndex;

    //     // Estimate the current indent using the column in front of the \begin{row} command
    //     const currentIndentSize = row.astNode.range.from.column + this.indentSize;

    //     // Get the position where to insert the new row
    //     const insertPosition = this.getCellInsertPosition(row, cellIndex);

    //     // Determine the size of the new cell
    //     let cellToResize = null;
    //     if (nbCells > 0) {
    //         cellToResize = cells[MathUtils.clamp(0, cellIndex - 1, row.lastCell.cellIndex)];
    //     }

    //     const newCellSize = cellToResize
    //         ? cellToResize.options.relativeSize / 2
    //         : 1;
    //     const newCellSizeAsString = MathUtils.round(newCellSize, 3).toString();

    //     // Resize another cell (to make space for the new cell) if required
    //     if (cellToResize) {
    //         const newSizeOfCellToResize = cellToResize.options.relativeSize - newCellSize;
    //         const newSizeOfCellToResizeAsString = this.getRelativeSizeAsString(newSizeOfCellToResize);

    //         await cellToResize.options.relativeSizeParameterNode.setTextContent(newSizeOfCellToResizeAsString);
    //     }

    //     // Insert a new cell
    //     const indent = " ".repeat(this.indentSize);
    //     const currentIndent = " ".repeat(currentIndentSize);
    //     const newRowText = [
    //         `${isNewLastCell ? "\n" + currentIndent : ""}`,
    //         `\\begin{cell}{${newCellSizeAsString}}\n`,
    //         `${currentIndent}${indent}~\n`,
    //         `${currentIndent}\\end{cell}`,
    //         `${!isNewLastCell ? "\n" : ""}`,
    //         `${!isNewLastCell ? currentIndent : ""}`
    //     ].join("");

    //     await this.sourceFile.makeAtomicChange(editBuilder => 
    //         editBuilder.insert(insertPosition.asVscodePosition, newRowText)
    //     );
    // }

    // private async deleteRow(row: Row): Promise<void> {
    //     if (!this.layout) {
    //         return;
    //     }

    //     const allRowsExceptDeletedRow = this.layout.rows.filter(someRow => someRow !== row);

    //     await row.astNode.deleteTextContent();
    //     await this.normalizeRowSizes(allRowsExceptDeletedRow);
    // }

    // private async deleteCell(cell: Cell): Promise<void> {
    //     const row = this.getRowAt(cell.rowIndex);
    //     const allRowCellsExceptDeletedRow = row.cells.filter(someCell => someCell !== cell);

    //     await cell.astNode.deleteTextContent();
    //     await this.normalizeCellSizes(allRowCellsExceptDeletedRow);
    // }

    protected async updateContentData(): Promise<void> {
        try {
            this.layout = await Layout.from(this.astNode, this.codeMapping);
            this.contentUpdateEndEventEmitter.fire(true);
        }
        catch (error) {
            console.log(`The content data update of the visualisation with UID ${this.uid} (${this.name}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);

        }
    }

    private static renderCellAsHtml(cell: Cell): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "class": "cell",
            "data-row-index": cell.rowIndex.toString(),
            "data-cell-index": cell.cellIndex.toString(),
            "data-relative-size": cell.options.relativeSize.toString()
        });

        return `<div ${attributes}>${cell.contentText}</div>`;
    }

    private static renderRowAsHtml(row: Row): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "class": "row",
            "data-row-index": row.rowIndex.toString(),
            "data-relative-size": row.options.relativeSize.toString(),
        });

        return `
            <div ${attributes}>
                ${row.cells
                    .map(cell => GridLayoutModel.renderCellAsHtml(cell))
                    .join("\n")
                }
            </div>
        `;
    }

    private static rendeLayoutAsHtml(layout: Layout): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "class": "layout",
            "data-width": layout.options.width.px.toString(),
            "data-height": layout.options.height.px.toString(),
        });

        return `
            <div ${attributes}>
                ${
                    layout.rows
                        .map(GridLayoutModel.renderRowAsHtml)
                        .join("\n")
                    }
            </div>
        `;
    }
}