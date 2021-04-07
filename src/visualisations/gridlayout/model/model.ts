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
                    this.logEvent("select-cell-content");
                }
            },
            {
                title: "create-row",
                handler: async payload => {
                    const { rowIndex } = payload;
                    await this.createRow(rowIndex);
                    this.logEvent("create-row");
                }
            },
            {
                title: "create-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;
                    await this.createCell(rowIndex, cellIndex);
                    this.logEvent("create-cell");
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
                        this.logEvent("move-cell");
                }
            },
            {
                title: "delete-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex } = payload;
                    await this.deleteCell(rowIndex, cellIndex);
                    this.logEvent("delete-cell");
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
                    
                    if (isFinalSize) {
                        this.logEvent("resize-cells");
                    }
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
                    
                    if (isFinalSize) {
                        this.logEvent("resize-rows");
                    }
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