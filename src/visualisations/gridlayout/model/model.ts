import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Layout, Row } from "./Layout";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";

class NoLayoutError {}

export class GridLayoutModel extends AbstractVisualisationModel<EnvironmentNode> {
    readonly name = "grid layout";
    private layout: Layout | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: VisualisationModelUtilities) {
        super(context, utilities);
        this.layout = null;
    }

    protected get contentDataAsHtml(): string {
        return `
            <div class="layout">
                ${this.layout?.rows.map(GridLayoutModel.renderRowAsHtml).join("\n")}
            </div>
        `;
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

                    await this.resizeCell(cell, newRelativeSize);
                }
            },
            {
                title: "resize-row",
                handler: async payload => {
                    const { rowIndex, newHeight, isFinalSize } = payload;
                    const row = this.getRowAt(rowIndex);

                    await this.resizeRow(row, newHeight);
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

    private async resizeCell(cell: Cell, newRelativeSize: number): Promise<void> {
        // Round the number of decimals of the new size
        const maxNbDecimals = 3;
        const tenPowerNbDecimals = 10 ** maxNbDecimals;
        const newSizeAsString =
            ((Math.round(newRelativeSize * tenPowerNbDecimals)) / tenPowerNbDecimals)
                .toString();

        await cell.options.relativeSizeParameterNode.setTextContent(newSizeAsString);
    }

    private async resizeRow(row: Row, newHeight: number): Promise<void> {
        // Round the new height and append the right suffix
        const newHeightAsString = `${Math.round(newHeight)}px`;

        await row.options.heightParameterNode.setTextContent(newHeightAsString);
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
            "data-row": cell.rowIndex.toString(),
            "data-cell": cell.cellIndex.toString(),
            "data-relative-size": cell.options.relativeSize.toString()
        });

        return `<div ${attributes}>${cell.contentText}</div>`;
    }

    private static renderRowAsHtml(row: Row): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "class": "row",
            "data-row": row.rowIndex.toString(),
            "data-height": row.options.height.px.toString(),
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
}