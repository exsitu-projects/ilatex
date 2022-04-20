import * as vscode from "vscode";
import { TransitionalModel, ViewMessageHandlerSpecification } from "../../../core/transitionals/TransitionalModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { Cell, Grid, Row } from "./Grid";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { edits } from "./edits";


export class NoGridError {}


export class TableTransitionalModel extends TransitionalModel<EnvironmentNode> {
    readonly name = "tabular";
    private grid: Grid | null;

    constructor(context: VisualisableCodeContext<EnvironmentNode>, utilities: TransitionalModelUtilities) {
        super(context, utilities);
        this.grid = null;
    }

    protected get contentDataAsHtml(): string {
        return this.grid
            ? TableTransitionalModel.renderGridAsHTML(this.grid)
            : "";
   }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "select-cell-content",
                handler: async payload => {
                    const { rowIndex, columnIndex } = payload;
                    await this.selectCellContent(rowIndex, columnIndex);
                    this.logEvent("select-cell-content");
                }
            },
            {
                title: "set-cell-content",
                handler: async payload => {
                    const { rowIndex, columnIndex, newContent } = payload;
                    await this.setCellContent(rowIndex, columnIndex, newContent);
                    this.logEvent("set-cell-content");
                }
            },
            {
                title: "add-row",
                handler: async payload => {
                    const { newRowIndex } = payload;
                    await this.createRow(newRowIndex);
                    this.logEvent("add-row");
                }
            },
            {
                title: "delete-row",
                handler: async payload => {
                    const { rowIndex } = payload;
                    await this.deleteRow(rowIndex);
                    this.logEvent("delete-row");
                }
            },
            {
                title: "move-row",
                handler: async payload => {
                    const { oldRowIndex, newRowIndex } = payload;
                    await this.moveRow(oldRowIndex, newRowIndex);
                    this.logEvent("move-row");
                }
            },
            {
                title: "add-column",
                handler: async payload => {
                    const { newColumnIndex } = payload;
                    await this.createColumn(newColumnIndex);
                    this.logEvent("add-column");
                }
            },
            {
                title: "delete-column",
                handler: async payload => {
                    const { columnIndex } = payload;
                    await this.deleteColumn(columnIndex);
                    this.logEvent("delete-column");
                }
            },
            {
                title: "move-column",
                handler: async payload => {
                    const { oldColumnIndex, newColumnIndex } = payload;
                    await this.moveColumn(oldColumnIndex, newColumnIndex);
                    this.logEvent("move-column");
                }
            },
        ];
    }

    private async applyWithGridOrIgnore(
        action: (grid: Grid) => Promise<void>,
        registerAsChangeRequestedByTheView: boolean = true
    ): Promise<void> {
        if (!this.grid) {
            return;
        }

        await action(this.grid);
        if (registerAsChangeRequestedByTheView) {
            this.registerChangeRequestedByTheView();   
        }
    }

    private async selectCellContent(rowIndex: number, columnIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            const cell = grid.getCellAt(rowIndex, columnIndex);
            await this.sourceFile.selectRangeInEditor(cell.contentRange);
        }, false);
    }

    private async setCellContent(rowIndex: number, columnIndex: number, newContent: string): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            const cell = grid.getCellAt(rowIndex, columnIndex);
            await this.astNode.applyEditsWithoutReparsing([
                edits.replaceCellContent(cell, newContent)
            ]);
        });
    }

    private async createRow(newRowIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.createRow(grid, newRowIndex)
            ]);
        });
    }

    private async deleteRow(rowIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.deleteRow(grid, rowIndex)
            ]);
        });
    }

    private async moveRow(fromRowIndex: number, toRowIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.moveRow(grid, fromRowIndex, toRowIndex)
            ]);
        });
    }

    private async createColumn(newColumnIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.createColumn(grid, newColumnIndex)
            ]);
        });
    }

    private async deleteColumn(columnIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.deleteColumn(grid, columnIndex)
            ]);
        });
    }

    private async moveColumn(fromColumnIndex: number, toColumnIndex: number): Promise<void> {
        await this.applyWithGridOrIgnore(async (grid: Grid) => {
            await this.astNode.applyEditsWithoutReparsing([
                edits.moveColumn(grid, fromColumnIndex, toColumnIndex)
            ]); 
        });
    }

    protected async updateContentData(): Promise<void> {
        try {
            this.grid = await Grid.from(this.astNode);
            // console.log("New grid model:", this.grid);

            this.contentUpdateEndEventEmitter.fire(true);
        }
        catch (error) {
            console.log(`The content data update of the transitional with UID ${this.uid} (${this.name}) failed.`);
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
                ${row.cells.map(cell => TableTransitionalModel.renderCellAsHTML(cell)).join("\n")}
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
                        TableTransitionalModel.renderRowAsHTML
                    ).join("\n")}
                </tbody>
            </table>
        `;
    }
}