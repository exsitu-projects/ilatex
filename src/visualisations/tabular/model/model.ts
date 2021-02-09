import * as vscode from "vscode";
import { AbstractVisualisationModel, ViewMessageHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { VisualisableCodeContext } from "../../../core/visualisations/VisualisationModelProvider";
import { VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModelUtilities";
import { Cell, Grid, Row } from "./Grid";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";


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
                }
            },
            {
                title: "move-column",
                handler: async payload => {
                    const { oldColumnIndex, newColumnIndex } = payload;
                    // console.info(`column ${oldColumnIndex} => column ${newColumnIndex}`);

                    await this.moveColumn(oldColumnIndex, newColumnIndex);
                }
            },
            {
                title: "move-row",
                handler: async payload => {
                    const { oldRowIndex, newRowIndex } = payload;
                    // console.info(`row ${oldRowIndex} => row ${newRowIndex}`);

                    await this.moveRow(oldRowIndex, newRowIndex);
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
        const editor = await this.sourceFile.getOrOpenInEditor();

        // Select the code
        // If the selected range is not visible, scroll to the selection
        const rangeToSelect = new vscode.Range(
            cell.contentStart.asVscodePosition,
            cell.contentEnd.asVscodePosition
        );
        
        editor.selections = [new vscode.Selection(rangeToSelect.start, rangeToSelect.end)];
        editor.revealRange(
            rangeToSelect,
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
    }

    private async replaceCellContent(cell: Cell, newContent: string): Promise<void> {
        const editor = await this.sourceFile.getOrOpenInEditor();
        
        const rangeToEdit = new vscode.Range(
            cell.contentStart.asVscodePosition,
            cell.contentEnd.asVscodePosition
        );

        await editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, newContent);
        });
    }

    private async moveColumn(oldColumnIndex: number, newColumnIndex: number): Promise<void> {
        // TODO: implement
    }

    private async moveRow(oldRowIndex: number, newRowIndex: number): Promise<void> {
        // TODO: implement
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