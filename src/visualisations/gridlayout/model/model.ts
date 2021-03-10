import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Layout, Row } from "./Layout";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { LightweightSourceFileEditor } from "../../../core/source-files/LightweightSourceFileEditor";
import { MathUtils } from "../../../shared/utils/MathUtils";
import { StringUtils } from "../../../shared/utils/StringUtils";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";
import { SourceFilePosition } from "../../../core/source-files/SourceFilePosition";

class NoLayoutError {}

export class GridLayoutModel extends AbstractVisualisationModel<EnvironmentNode> {
    readonly name = "grid layout";
    private layout: Layout | null;

    private readonly indentSize: number;

    private lightweightCellSizeEditor: LightweightSourceFileEditor | null;
    private lightweightRowHeightEditor: LightweightSourceFileEditor | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: VisualisationModelUtilities) {
        super(context, utilities);
        this.layout = null;

        this.indentSize = 2;

        this.lightweightCellSizeEditor = null;
        this.lightweightRowHeightEditor = null;
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
                    const cell = this.getCellAt(rowIndex, cellIndex);
                    await cell.astNode.selectRangeInEditor();
                }
            },
            {
                title: "resize-cells",
                handler: async payload => {
                    const { leftCellChange, rightCellChange, isFinalSize } = payload;
                    const leftCell = this.getCellAt(leftCellChange.rowIndex, leftCellChange.cellIndex);
                    const rightCell = this.getCellAt(rightCellChange.rowIndex, rightCellChange.cellIndex);

                    await this.resizeCells([
                        { cell: leftCell, newRelativeSize: leftCellChange.newRelativeSize },
                        { cell: rightCell, newRelativeSize: rightCellChange.newRelativeSize },
                    ], isFinalSize);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "resize-rows",
                handler: async payload => {
                    const { rowAboveChange, rowBelowChange, isFinalSize } = payload;
                    const rowAbove = this.getRowAt(rowAboveChange.rowIndex);
                    const rowBelow = this.getRowAt(rowBelowChange.rowIndex);

                    await this.resizeRows([
                        { row: rowAbove, newRelativeSize: rowAboveChange.newRelativeSize },
                        { row: rowBelow, newRelativeSize: rowBelowChange.newRelativeSize },
                    ], isFinalSize);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "create-row",
                handler: async payload => {
                    const { rowIndex } = payload;
                    await this.createRowAt(rowIndex);
                }
            },
            {
                title: "create-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;
                    await this.createCellAt(rowIndex, cellIndex);
                }
            },
            {
                title: "move-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex, targetRowIndex, targetCellIndex } = payload;
                    const cell = this.getCellAt(rowIndex, cellIndex);
                    await this.moveCell(cell, targetRowIndex, targetCellIndex);
                }
            },
            {
                title: "delete-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;

                    // If the row only contains one cell, delete the row instead
                    const row = this.getRowAt(rowIndex);
                    if (row.nbCells <= 1) {
                        await this.deleteRow(row);
                    }
                    else {
                        const cell = this.getCellAt(rowIndex, cellIndex);
                        await this.deleteCell(cell);
                    }
                }
            },
        ];
    }

    private getRowAt(rowIndex: number): Row {
        if (!this.layout) {
            throw new NoLayoutError();
        }

        return this.layout.rows[rowIndex];
    }

    private getCellAt(rowIndex: number, cellIndex: number): Cell {
        return this.getRowAt(rowIndex)
            .cells[cellIndex];
    }

    private async resizeCells(sortedChanges: { cell: Cell, newRelativeSize: number}[], isFinalSize: boolean): Promise<void> {
        // Associate a unique editable section name to each cell
        const nameSectionAfterCell = (cell: Cell) => `${cell.rowIndex}-${cell.cellIndex}`;

        if (!this.lightweightCellSizeEditor) {
            const editableSections = sortedChanges.map(change => {
                return {
                    name: nameSectionAfterCell(change.cell),
                    range: change.cell.options.relativeSizeParameterNode.range
                };
            });

            this.lightweightCellSizeEditor = this.sourceFile.createLightweightEditorFor(editableSections);
            await this.lightweightCellSizeEditor.init();
        }
        
        for (let change of sortedChanges) {
            await this.lightweightCellSizeEditor.replaceSectionContent(
                nameSectionAfterCell(change.cell),
                MathUtils.round(change.newRelativeSize, 3).toString()
            );
        }

        if (isFinalSize) {
            await this.lightweightCellSizeEditor.applyChange();
            this.lightweightCellSizeEditor = null;
        }
    }

    private async resizeRows(sortedChanges: { row: Row, newRelativeSize: number}[], isFinalSize: boolean): Promise<void> {
        // Associate a unique editable section name to each row
        const nameSectionAfterRow = (row: Row) => `${row.rowIndex}`;

        if (!this.lightweightRowHeightEditor) {
            const editableSections = sortedChanges.map(change => {
                return {
                    name: nameSectionAfterRow(change.row),
                    range: change.row.options.relativeSizeParameterNode.range
                };
            });

            this.lightweightRowHeightEditor = this.sourceFile.createLightweightEditorFor(editableSections);
            await this.lightweightRowHeightEditor.init();
        }
        
        for (let change of sortedChanges) {
            await this.lightweightRowHeightEditor.replaceSectionContent(
                nameSectionAfterRow(change.row),
                MathUtils.round(change.newRelativeSize, 3).toString()
            );
        }

        if (isFinalSize) {
            await this.lightweightRowHeightEditor.applyChange();
            this.lightweightRowHeightEditor = null;
        }
    }

    private async createRowAt(rowIndex: number): Promise<void> {
        if (!this.layout) {
            return;
        }

        console.info("=== Insert new row at: ", rowIndex);
        console.log(this.layout);

        const nbRows = this.layout.nbRows;
        const rows = this.layout.rows;
        const isNewLastRow = rowIndex > this.layout.lastRow.rowIndex;

        // Estimate the current indent using the column in front of the \begin{gridlayout} command
        const currentIndentSize = this.astNode.range.from.column + this.indentSize;

        // The new row should be inserted
        // - at the start of the env. body if the index is 0 and there is no row, or
        // - before the row with the given index if there is one, or
        // - at the end of the last row if the index is greater than its row index
        let insertPosition = this.astNode.body.range.from;
        if (nbRows > 0) {
            insertPosition = isNewLastRow
                ? this.layout.lastRow.astNode.range.to
                : rows[rowIndex].astNode.range.from;
        }

        // Determine the size of the new row
        let rowToResize = null;
        if (nbRows > 0) {
            rowToResize = rows[MathUtils.clamp(0, rowIndex - 1, this.layout.lastRow.rowIndex)];
        }

        const newRowSize = rowToResize
            ? rowToResize.options.relativeSize / 2
            : 1;
        const newRowSizeAsString = MathUtils.round(newRowSize, 3).toString();

        // Resize another row (to make space for the new row) if required
        if (rowToResize) {
            const newSizeOfRowToResize = rowToResize.options.relativeSize - newRowSize;
            const newSizeOfRowToResizeAsString = MathUtils.round(newSizeOfRowToResize, 3).toString();

            await rowToResize.options.relativeSizeParameterNode.setTextContent(newSizeOfRowToResizeAsString);
        }

        // Insert a new row with a single cell
        const indent = " ".repeat(this.indentSize);
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

        await this.sourceFile.makeAtomicChange(editBuilder => 
            editBuilder.insert(insertPosition.asVscodePosition, newRowText)
        );
    }

    private async createCellAt(rowIndex: number, cellIndex: number): Promise<void> {
        if (!this.layout) {
            return;
        }

        if (rowIndex > this.layout.rows.length - 1) {
            console.warn(`The grid layout's cell cannot be created: there is no row at index ${rowIndex}.`);
            return;
        }

        const row = this.layout.rows[rowIndex];
        const cells = row.cells;
        const nbCells = row.nbCells;
        const isNewLastCell = nbCells === 0 || cellIndex > row.lastCell.cellIndex;

        // Estimate the current indent using the column in front of the \begin{row} command
        const currentIndentSize = row.astNode.range.from.column + this.indentSize;

        // The new cell should be inserted
        // - at the start of the row body if the index is 0 and there is no cell, or
        // - before the cell with the given index if there is one, or
        // - at the end of the last cell if the index is greater than its cell index
        let insertPosition = row.astNode.body.range.from;
        if (nbCells > 0) {
            insertPosition = isNewLastCell
                ? row.lastCell.astNode.range.to
                : cells[cellIndex].astNode.range.from;
        }

        // Determine the size of the new row
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
            const newSizeOfCellToResizeAsString = MathUtils.round(newSizeOfCellToResize, 3).toString();

            await cellToResize.options.relativeSizeParameterNode.setTextContent(newSizeOfCellToResizeAsString);
        }

        // Insert a new cell
        const indent = " ".repeat(this.indentSize);
        const currentIndent = " ".repeat(currentIndentSize);
        const newRowText = [
            `${isNewLastCell ? "\n" + currentIndent : ""}`,
            `\\begin{cell}{${newCellSizeAsString}}\n`,
            `${currentIndent}${indent}~\n`,
            `${currentIndent}\\end{cell}`,
            `${!isNewLastCell ? "\n" : ""}`,
            `${!isNewLastCell ? currentIndent : ""}`
        ].join("");

        await this.sourceFile.makeAtomicChange(editBuilder => 
            editBuilder.insert(insertPosition.asVscodePosition, newRowText)
        );
    }

    private async deleteRow(row: Row): Promise<void> {
        await row.astNode.deleteTextContent();
    }

    private async deleteCell(cell: Cell): Promise<void> {
        await cell.astNode.deleteTextContent();
    }

    private async moveCell(cell: Cell, targetRowIndex: number, targetCellIndex: number): Promise<void> {
        // TODO: implement
        console.info("moveCell");
    }

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