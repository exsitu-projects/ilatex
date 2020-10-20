import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTEnvironementNode, ASTNodeType, ASTParameterNode, ASTLatexNode } from "../../../core/ast/LatexASTNode";
import { InteractiveLaTeX } from "../../../core/InteractiveLaTeX";
import { WebviewManager } from "../../../core/webview/WebviewManager";
import { Cell, Grid, GridExtractor } from "./GridExtractor";
import { Options, OptionsExtractor } from "./OptionsExtractor";


class TabularModel extends AbstractVisualisationModel<ASTEnvironementNode> {
    static readonly visualisationName = "tabular";
    readonly visualisationName = TabularModel.visualisationName;

    private optionsNode: ASTParameterNode;
    private contentNode: ASTLatexNode;

    private grid: Grid;
    private options: Options;

    constructor(node: ASTEnvironementNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, ilatex, editor, webviewManager);

        this.optionsNode = this.astNode.value.parameters[0][0] as ASTParameterNode;
        this.contentNode = this.astNode.value.content as ASTLatexNode;

        this.grid = this.extractGridFromASTNode();
        this.options = this.extractOptionsFromASTNode();
    }

    private extractGridFromASTNode(): Grid {
        const gridExtractor = new GridExtractor(this.editor.document);
        this.contentNode.visitWith(gridExtractor);

        return gridExtractor.grid;
    }

    private extractOptionsFromASTNode(): Options {
        const optionExtractor = new OptionsExtractor();
        this.optionsNode.visitWith(optionExtractor);

        return optionExtractor.options;
    }

    private getCellAt(rowIndex: number, columnIndex: number): Cell {
        console.log(`. Get cell at [${rowIndex}, ${columnIndex}]: `,
            this.grid.rows[rowIndex][columnIndex]);
        return this.grid.rows[rowIndex][columnIndex];
    }

    private async selectCellContent(cell: Cell): Promise<void> {
        // Select the code
        const startPosition = new vscode.Position(cell.contentStart.line - 1, cell.contentStart.column - 1);
        const endPosition = new vscode.Position(cell.contentEnd.line - 1, cell.contentEnd.column - 1);
        this.editor.selections = [new vscode.Selection(startPosition, endPosition)];

        // If the selected range is not visible, scroll to the selection
        this.editor.revealRange(
            new vscode.Range(startPosition, endPosition),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
    }

    private async replaceCellContent(cell: Cell, newContent: string): Promise<void> {
        const rangeToEdit = new vscode.Range(
            new vscode.Position(cell.contentStart.line - 1, cell.contentStart.column - 1),
            new vscode.Position(cell.contentEnd.line - 1, cell.contentEnd.column - 1)
        );

        await this.editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, newContent);
        });
    }

    private async moveColumn(oldColumnIndex: number, newColumnIndex: number): Promise<void> {
        const rows = this.grid.rows;

        // Copy the content of the cells of the origin and target columns
        console.log("Extract content from grid: ", rows);
        const originColumnCellsContent = rows
            .map(row => row[oldColumnIndex]?.textContent);

        let updateCellContentAt;
        if (oldColumnIndex > newColumnIndex) {
            // Case 1: the column is moved from right to left (<--)
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                if (columnIndex <= oldColumnIndex && columnIndex > newColumnIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex, columnIndex - 1);

                    console.log(`About to replace ${cellToEdit.textContent} by ${cellToCopy.textContent}`);
                    await this.replaceCellContent(cellToEdit, cellToCopy.textContent);

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

                    console.log(`About to replace ${cellToEdit.textContent} by ${newContent}`);
                    await this.replaceCellContent(cellToEdit, newContent);
                    
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
            if (row.length - 1 < Math.max(oldColumnIndex, newColumnIndex)) {
                continue;
            }

            for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex--) {
                console.log(`===== Update cell at ${rowIndex}, ${columnIndex} =====`);
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
                if (row.length - 1 < Math.max(oldColumnIndex, newColumnIndex)) {
                    continue;
                }
                
                await this.replaceCellContent(
                    row[newColumnIndex],
                    originColumnCellsContent[rowIndex]
                );
            }
        }
    }

    // Note: reordering only works as long as two rows are never (partially) on the same line
    // TODO: remove this limitation?
    private async moveRow(oldRowIndex: number, newRowIndex: number): Promise<void> {
        const rows = this.grid.rows;

        // Copy the content of the cells of the origin row (before any move)
        console.log("Extract content from grid: ", rows);
        const originRowCellsContent = rows[oldRowIndex].map(cell => cell.textContent);

        let updateCellContentAt;
        // Case 1: the row is moved from bottom to top (^^^)
        if (newRowIndex < oldRowIndex) {
            updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                if (rowIndex > newRowIndex && rowIndex <= oldRowIndex) {
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const cellToCopy = this.getCellAt(rowIndex - 1, columnIndex);

                    console.log(`About to replace ${cellToEdit.textContent} by ${cellToCopy.textContent}`);
                    await this.replaceCellContent(cellToEdit, cellToCopy.textContent);

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
                    if (columnIndex === rows[rowIndex].length - 1) {
                        lastEditedRowCellContent = currentEditedRowCellContent;
                        currentEditedRowCellContent = rows[rowIndex].map(cell => cell.textContent);
                    }

                    // Edit the content of the cell
                    // If this is the last row to edit (i.e. the target row),
                    // use the content of the origin row (instead of the content of the row below)
                    const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                    const newContent = rowIndex === newRowIndex
                                        ? originRowCellsContent[columnIndex]
                                        : lastEditedRowCellContent[columnIndex];

                    console.log(`About to replace ${cellToEdit.textContent} by ${newContent}`);
                    await this.replaceCellContent(cellToEdit, newContent);
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

            for (let columnIndex = row.length - 1; columnIndex >= 0; columnIndex--) {
                console.log(`===== Update cell at ${rowIndex}, ${columnIndex} =====`);
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
                await this.replaceCellContent(
                    row[columnIndex],
                    originRowCellsContent[columnIndex]
                );
            }
        }
    }

    protected createContentAttributes(): Record<string, string> {
        return {
            ...super.createContentAttributes(),

            // Add node location information
            "data-loc-start": `${this.astNode.start.line};${this.astNode.start.column}`,
            "data-loc-end": `${this.astNode.end.line};${this.astNode.end.column}`
        };
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            ...super.createNotificationHandlerSpecifications(),

            {
                title: "select-cell-code",
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

                    // A new parsing of the document must be requested
                    // to generate new visualisations from the modified code
                    this.requestNewParsing();
                }
            },
            {
                title: "reorder-column",
                handler: async payload => {
                    const { oldColumnIndex, newColumnIndex } = payload;
                    console.info(`column ${oldColumnIndex} => column ${newColumnIndex}`);

                    await this.moveColumn(oldColumnIndex, newColumnIndex);
                    
                    // A new parsing of the document must be requested
                    // to generate new visualisations from the modified code
                    this.requestNewParsing();
                }
            },
            {
                title: "reorder-row",
                handler: async payload => {
                    const { oldRowIndex, newRowIndex } = payload;
                    console.info(`row ${oldRowIndex} => row ${newRowIndex}`);

                    await this.moveRow(oldRowIndex, newRowIndex);
                    
                    // A new parsing of the document must be requested
                    // to generate new visualisations from the modified code
                    this.requestNewParsing();
                }
            }
        ];
    }

    protected renderContentAsHTML(): string {
        return `
            <table>
                <thead>
                    ${this.options.columnTypes.map(
                        column => `<th>${column}</th>`
                    ).join("\n")}
                </thead>
                <tbody>
                    ${this.grid.rows.map(
                        TabularModel.renderRowAsHTML
                    ).join("\n")}
                </tbody>
            </table>
        `;
    }

    private static renderCellAsHTML(cell: Cell): string {
        function getAttributesAsHTML(cell: Cell) {
            const attributes = {
                "data-row": cell.rowIndex,
                "data-column": cell.columnIndex
            };
            
            return Object.entries(attributes)
                .map(([key, value]) => `${key}="${value}"`)
                .join(" ");
        }

        return `<td ${getAttributesAsHTML(cell)}>${cell.textContent}</td>`;
    }

    private static renderRowAsHTML(row: Cell[]): string {
        return `
            <tr>
                ${row.map(cell => TabularModel.renderCellAsHTML(cell)).join("\n")}
            </tr>
        `;
    }
}

export default class TabularModelFactory implements VisualisationModelFactory {
    readonly visualisationName = TabularModel.visualisationName;
    readonly codePatternMatcher = (node: ASTNode) => {
        return node.type === ASTNodeType.Environement
            && node.name === "tabular";
    };

    createModel(node: ASTNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager): VisualisationModel {
        return new TabularModel(node as ASTEnvironementNode, ilatex, editor, webviewManager);
    }
}