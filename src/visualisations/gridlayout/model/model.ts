import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Layout, Row } from "./Layout";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { LightweightSourceFileEditor } from "../../../core/source-files/LightweightSourceFileEditor";
import { MathUtils } from "../../../shared/utils/MathUtils";

class NoLayoutError {}

export class GridLayoutModel extends AbstractVisualisationModel<EnvironmentNode> {
    readonly name = "grid layout";
    private layout: Layout | null;

    private lightweightCellSizeEditor: LightweightSourceFileEditor | null;
    private lightweightRowHeightEditor: LightweightSourceFileEditor | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: VisualisationModelUtilities) {
        super(context, utilities);
        this.layout = null;

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
                    const row = this.getCellAt(rowIndex, cellIndex);
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
            }
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