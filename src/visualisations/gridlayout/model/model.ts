import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Layout, Row } from "./Layout";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { LightweightSourceFileEditor } from "../../../core/source-files/LightweightSourceFileEditor";

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
                title: "resize-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex, newRelativeSize, isFinalSize } = payload;
                    const cell = this.getCellAt(rowIndex, cellIndex);

                    await this.resizeCell(cell, newRelativeSize, isFinalSize);
                    this.registerChangeRequestedByTheView();
                }
            },
            {
                title: "resize-row",
                handler: async payload => {
                    const { rowIndex, newHeight, isFinalSize } = payload;
                    const row = this.getRowAt(rowIndex);

                    await this.resizeRow(row, newHeight, isFinalSize);
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

    private async resizeCell(cell: Cell, newRelativeSize: number, isFinalSize: boolean): Promise<void> {
        // Round the number of decimals of the new size
        const maxNbDecimals = 3;
        const tenPowerNbDecimals = 10 ** maxNbDecimals;
        const newSizeAsString =
            ((Math.round(newRelativeSize * tenPowerNbDecimals)) / tenPowerNbDecimals)
                .toString();

        if (!this.lightweightCellSizeEditor) {
            const editRange = cell.options.relativeSizeParameterNode.range;
            this.lightweightCellSizeEditor = this.sourceFile.createLightweightEditorFor(editRange);
            await this.lightweightCellSizeEditor.init();
        }
        
        await this.lightweightCellSizeEditor.replaceContentWith(newSizeAsString);
        if (isFinalSize) {
            await this.lightweightCellSizeEditor.applyChange();
            this.lightweightCellSizeEditor = null;
        }
    }

    private async resizeRow(row: Row, newHeight: number, isFinalSize: boolean): Promise<void> {
        // Round the new height and append the right suffix
        const newHeightAsString = `${Math.round(newHeight)}px`;

        if (!this.lightweightRowHeightEditor) {
            const editRange = row.options.relativeSizeParameterNode.range;
            this.lightweightRowHeightEditor = this.sourceFile.createLightweightEditorFor(editRange);
            await this.lightweightRowHeightEditor.init();
        }
        
        await this.lightweightRowHeightEditor.replaceContentWith(newHeightAsString);
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