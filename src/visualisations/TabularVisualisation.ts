import * as vscode from "vscode";
import * as P from "parsimmon";
import { Visualisation, WebviewNotificationHandlerSpecification } from "./Visualisation";
import { ASTEnvironementNode, ASTNode, ASTNodeType, ASTCommandNode, ASTSpecialSymbolNode, ASTParameterNode, ASTLatexNode } from "../ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";
import { WebviewManager } from "../webview/WebviewManager";
import { InteractiveLaTeX } from "../InteractiveLaTeX";

interface TabularOptions {
    columns: string[];
}

interface Cell {
    rowIndex: number;
    columnIndex: number;
    contentStart: P.Index;
    contentEnd: P.Index;
    nodes: ASTNode[],
    textContent: string;
}

interface Tabular {
    grid: Cell[][];
    options: TabularOptions;
}

class GridCellsReader extends LatexASTVisitorAdapter {
    // The choice of commands not considered as content is strongly inspired by
    // https://en.wikibooks.org/wiki/LaTeX/Tables
    private static readonly NON_CONTENT_COMMAND_NAMES: string[] = [
        "toprule",
        "midrule",
        "bottomrule",
        "hline",
        "cline"
    ];

    private grid: Cell[][];
    private document: vscode.TextDocument;

    // Current row and cell
    private currentRow: Cell[];
    private currentRowIndex: number;
    private currentColumnIndex: number;
    private currentCellNodes: ASTNode[];

    constructor(grid: Cell[][], document: vscode.TextDocument) {
        super();
        this.grid = grid;
        this.document = document;

        this.currentRow = [];
        this.grid.push(this.currentRow);

        this.currentRowIndex = 0;
        this.currentColumnIndex = 0;
        this.currentCellNodes = [];
    }

    isCurrentCellEmpty(): boolean {
        return this.currentCellNodes.length === 0;
    }

    private getCellContent = (start: P.Index, end: P.Index): string => {
        return this.document.getText(new vscode.Range(
            new vscode.Position(start.line - 1, start.column - 1),
            new vscode.Position(end.line - 1, end.column - 1)
        ));
    };

    private getCurrentCellContentLocation(): {start: P.Index, end: P.Index} {
        const firstNode = this.currentCellNodes[0];
        const lastNode =  this.currentCellNodes[this.currentCellNodes.length - 1];

        // All the leading/trailing nodes which are
        // whitespace or "non-content" commands should be skipped
        function shouldSkipNode(node: ASTNode): boolean {
            return node.type === ASTNodeType.Whitespace
                || (node.type === ASTNodeType.Command
                    && GridCellsReader.NON_CONTENT_COMMAND_NAMES.includes(node.name));
        }

        // If the cell only contains skippable nodes,
        // consider its content as an empty string located at the end of the node
        if (this.currentCellNodes.every(node => shouldSkipNode(node))) {
            return {
                start: lastNode.end,
                end: lastNode.end
            };
        }
        
        // Otherwise, update the start and end positions
        // to ignore any leading/trailing whitespace and special command nodes
        // Note: this works well since we know that at least one node won't be skipped!
        const location = {
            start: firstNode.start,
            end: lastNode.end
        };

        for (let i = 0; i < this.currentCellNodes.length; i++) {
            const node = this.currentCellNodes[i];
            if (shouldSkipNode(node)) {
                location.start = node.end;
            }
            else {
                break;
            };
        }

        for (let i = this.currentCellNodes.length - 1; i >= 0; i--) {
            const node = this.currentCellNodes[i];
            if (shouldSkipNode(node)) {
                location.end = node.start;
            }
            else {
                break;
            };
        }

        return location;
    }

    addCurrentCellToGrid(): void {
        // Add a cell to the current row
        const {start, end} = this.getCurrentCellContentLocation();
        this.currentRow.push({
            rowIndex: this.currentRowIndex,
            columnIndex: this.currentColumnIndex,
            contentStart: start,
            contentEnd: end,
            nodes: this.currentCellNodes,
            textContent: this.getCellContent(start, end)
        });

        // Reset the array of nodes
        this.currentCellNodes = [];
    }

    // removeSpecialCommandRows(): void {
    //     const specialCommandNames = [
    //         "toprule",
    //         "midrule",
    //         "bottomrule"
    //     ];

    //     for (let row of this.grid) {
    //         // Only consider rows with a single cell
    //         if (row.length !== 1) {
    //             continue;
    //         }

    //         // Iterate over the command nodes contained in the cell
    //         const cell = row[0];
    //         const commandNodes = cell.nodes.filter(node =>
    //             node.type === ASTNodeType.Command
    //         );

    //         for (let commandNode of commandNodes) {
    //             // If a special command is found, remove this row from the grid
    //             if (specialCommandNames.includes(commandNode.name)) {
                    
    //             }
    //         }
    //     }
    // }

    protected visitCommandNode(node: ASTCommandNode) {
        const commandName = node.name;
        if (commandName === "\\") {
            if (!this.isCurrentCellEmpty()) {
                this.addCurrentCellToGrid();
            }

            // Update the current position in the grid
            this.currentRowIndex += 1;
            this.currentColumnIndex = 0;

            // Create a new row in the grid
            this.currentRow = [];
            this.grid.push(this.currentRow);
        }
        else {
            this.visitNode(node);
        }
    }

    protected visitSpecialSymbolNode(node: ASTSpecialSymbolNode) {
        const symbolName = node.name;
        if (symbolName === "ampersand") {
            if (!this.isCurrentCellEmpty()) {
                this.addCurrentCellToGrid();
            }

            // Update the current position in the grid
            this.currentColumnIndex += 1;
        }
        else {
            this.visitNode(node);
        }
    }

    protected visitNode(node: ASTNode) {
        this.currentCellNodes.push(node);
    }
}

// Based on https://en.wikibooks.org/wiki/LaTeX/Tables#The_tabular_environment
// Support the most common values for the required parameter of tabular
const tabularColumnOptionLanguage = P.createLanguage<{
    alignedColumn: string,
    sizedColumn: string,
    otherCharacter: null,
    columns: string[]
}>({
    alignedColumn: lang => {
        return P.oneOf("lcr");
    },

    sizedColumn: lang => {
        return P.seq(
            P.oneOf("pmb"),
            P.string("{"),
            P.regex(/[^\}]/),
            P.string("}")
        ).tie();
    },

    otherCharacter: lang => {
        return P.noneOf("lcrpmb")
            .map(() => null);
    },

    columns: lang => {
        return P.alt(
           lang.alignedColumn,
           lang.sizedColumn,
           lang.otherCharacter
        )
            .atLeast(1)
            .map(columns => columns.filter(c => c !== null) as string[]);
    }
});

export class TabularVisualisation extends Visualisation<ASTEnvironementNode> {
    readonly name = "tabular";

    private tabular: Tabular;

    private optionsNode: ASTParameterNode;
    private contentNode: ASTLatexNode;
    
    constructor(node: ASTEnvironementNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, ilatex, editor, webviewManager);

        this.tabular = {
            grid: [],
            options: {
                columns: []
            }
        };

        this.contentNode = this.node.value.content as ASTLatexNode;
        this.optionsNode = this.node.value.parameters[0][0] as ASTParameterNode;

        this.extractTabular();
        this.initProps();
    }

    protected initProps(): void {
        super.initProps();

        // Add node location information
        this.props["data-loc-start"] = `${this.node.start.line};${this.node.start.column}`;
        this.props["data-loc-end"] = `${this.node.end.line};${this.node.end.column}`;

        // Enable the selection of the associated block of code on click
        this.props["class"] += " selectable";
    }

    private getCellAt(rowIndex: number, columnIndex: number): Cell {
        console.log(`. Get cell at [${rowIndex}, ${columnIndex}]: `,
            this.tabular.grid[rowIndex][columnIndex]);
        return this.tabular.grid[rowIndex][columnIndex];
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

    protected getWebviewNotificationHandlerSpecifications(): WebviewNotificationHandlerSpecification[] {
        return [
            ...super.getWebviewNotificationHandlerSpecifications(),

            {
                subject: "select-cell-code",
                handler: async payload => {
                    // TODO: implement selection sonewhere else
                    const { rowIndex, columnIndex } = payload;
                    const cell = this.getCellAt(rowIndex, columnIndex);
                    
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
            },
            {
                subject: "set-cell-content",
                handler: async payload => {
                    // TODO: implement edition somewhere else
                    const { rowIndex, columnIndex, newContent } = payload;
                    const cell = this.getCellAt(rowIndex, columnIndex);

                    // Replace the content of the cell
                    await this.replaceCellContent(cell, newContent);

                    // Request a new parsing to generate new vis. from the modified code
                    this.requestNewParsing();
                }
            },
            {
                subject: "reorder-column",
                handler: async payload => {
                    const grid = this.tabular.grid;

                    // TODO: possibly implement reordering somewhere else?
                    const { oldColumnIndex, newColumnIndex } = payload;
                    console.info(`column ${oldColumnIndex} => column ${newColumnIndex}`);

                    // Copy the content of the cells of the origin and target columns
                    console.log("Extract content from grid: ", grid);
                    const originColumnCellsContent = grid
                        .map(row => row[oldColumnIndex]?.textContent);

                    let updateCellContentAt;
                    // Case 1: the column is moved from right to left (<--)
                    if (oldColumnIndex > newColumnIndex) {
                        updateCellContentAt = async (rowIndex: number, columnIndex: number) => {
                            if (columnIndex <= oldColumnIndex && columnIndex > newColumnIndex) {
                                const cellToEdit = this.getCellAt(rowIndex, columnIndex);
                                const cellToCopy = this.getCellAt(rowIndex, columnIndex - 1);

                                console.log(`About to replace ${cellToEdit.textContent} by ${cellToCopy.textContent}`);
                                await this.replaceCellContent(cellToEdit, cellToCopy.textContent);

                            }
                        };
                    }
                    // Case 2: the column is moved from left to right (-->)
                    // In this case, the content of the target column is also updated by this function
                    // (for each line, it must be done first since the target cell is the rightmost edited cell)
                    else if (newColumnIndex > oldColumnIndex) {
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
                    // Case 3: the column is not moved (no cell content has to be updated)
                    else {
                        return;
                    }

                    // Shift the columns between the two indices
                    for (let rowIndex = grid.length - 1; rowIndex >= 0; rowIndex--) {
                        const row = grid[rowIndex];

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
                        for (let rowIndex = grid.length - 1; rowIndex >= 0; rowIndex--) {
                            const row = grid[rowIndex];
                            
                            // Skip rows which do not "syntaxically" span to
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

                    // Request a new parsing to generate new vis. from the modified code
                    this.requestNewParsing();
                }
            },
            {
                // Note: reordering only works as long as two rows are never (partially) on the same line
                // TODO: remove this limitation?
                subject: "reorder-row",
                handler: async payload => {
                    const grid = this.tabular.grid;

                    // TODO: possibly implement reordering somewhere else?
                    const { oldRowIndex, newRowIndex } = payload;
                    console.info(`row ${oldRowIndex} => row ${newRowIndex}`);

                    // Copy the content of the cells of the origin row (before any move)
                    console.log("Extract content from grid: ", grid);
                    const originRowCellsContent = grid[oldRowIndex].map(cell => cell.textContent);

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
                                if (columnIndex === grid[rowIndex].length - 1) {
                                    lastEditedRowCellContent = currentEditedRowCellContent;
                                    currentEditedRowCellContent = grid[rowIndex].map(cell => cell.textContent);
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
                        const row = grid[rowIndex];

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
                            const row = grid[newRowIndex];
                            await this.replaceCellContent(
                                row[columnIndex],
                                originRowCellsContent[columnIndex]
                            );
                        }
                    }

                    // Request a new parsing to generate new vis. from the modified code
                    this.requestNewParsing();
                }
            }
        ];
    }

    private extractTabularGrid(): void {
        const gridCellReader = new GridCellsReader(this.tabular.grid, this.editor.document);
        for (let node of this.contentNode.value) {
            node.visitWith(gridCellReader, 0, 0);
        }

        // Ensure the last cell of the grid is not forgotten
        // (in case the last node of the env. content is part of a call)
        if (!gridCellReader.isCurrentCellEmpty()) {
            gridCellReader.addCurrentCellToGrid();
        }
    }

    private extractTabularOptions(): void {
        try {
            this.tabular.options.columns = tabularColumnOptionLanguage.columns
                .tryParse(this.optionsNode.value);
        }
        catch (error) {
            console.error("Error during tabular option parsing:", error);
        }
    }

    private extractTabular(): void {
        this.extractTabularGrid();
        this.extractTabularOptions();

        console.log("tabular has been extracted");
        console.log(this.tabular);
    }
    
    renderContentAsHTML(): string {
        return `
            <table>
                <thead>
                    ${this.tabular.options.columns.map(column => `<th>${column}</th>`).join("\n")}
                </thead>
                <tbody>
                    ${this.tabular.grid.map(TabularVisualisation.renderRowAsHTML).join("\n")}
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
                ${row.map(cell => TabularVisualisation.renderCellAsHTML(cell)).join("\n")}
            </tr>
        `;
    }
}