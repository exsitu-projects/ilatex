import * as vscode from "vscode";
import * as P from "parsimmon";
import { Visualisation, WebviewNotificationHandlerSpecification } from "./Visualisation";
import { ASTEnvironementNode, ASTNode, ASTNodeType, ASTCommandNode, ASTSpecialSymbolNode, ASTParameterNode, ASTLatexNode } from "../ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";
import { WebviewManager } from "../webview/WebviewManager";

interface TabularOptions {
    columns: string[];
}

interface Cell {
    rowIndex: number;
    columnIndex: number;
    start: P.Index;
    end: P.Index;
    textContent: string;
}

interface Tabular {
    grid: Cell[][];
    options: TabularOptions;
}

class GridCellsReader extends LatexASTVisitorAdapter {
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
        // If the cell only contains a single whitespace node,
        // consider its content as an empty string located at the end of the node
        if (this.currentCellNodes.length === 1
        &&  this.currentCellNodes[0].type === ASTNodeType.Whitespace) {
            const node = this.currentCellNodes[0];
            return {
                start: node.end,
                end: node.end
            };
        }
        
        // Otherwise, update the start and end positions
        // to ignore any leading/trailing whitespace nodes
        // Note: this works well since there canot be two successive whitespace nodes
        else {
            const location = {
                start: null as any,
                end: null as any
            };

            for (let i = 0; i < this.currentCellNodes.length; i++) {
                const node = this.currentCellNodes[i];
                if (node.type !== ASTNodeType.Whitespace) {
                    break;
                }

                location.start = node.end;
            }

            for (let i = this.currentCellNodes.length - 1; i >= 0; i--) {
                const node = this.currentCellNodes[i];
                if (node.type !== ASTNodeType.Whitespace) {
                    break;
                }

                location.end = node.start;
            }

            return location;
        }
    }

    addCurrentCellToGrid(): void {
        // Add a cell to the current row
        const {start, end} = this.getCurrentCellContentLocation();
        this.currentRow.push({
            rowIndex: this.currentRowIndex,
            columnIndex: this.currentColumnIndex,
            start: start,
            end: end,
            textContent: this.getCellContent(start, end)
        });

        // Reset the array of nodes
        this.currentCellNodes = [];
    }

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
    
    constructor(node: ASTEnvironementNode, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, editor, webviewManager);

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
        return this.tabular.grid[rowIndex][columnIndex];
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
                    const startPosition = new vscode.Position(cell.start.line - 1, cell.start.column - 1);
                    const endPosition = new vscode.Position(cell.end.line - 1, cell.end.column - 1);
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
                    const rangeToEdit = new vscode.Range(
                        new vscode.Position(cell.start.line - 1, cell.start.column - 1),
                        new vscode.Position(cell.end.line - 1, cell.end.column - 1)
                    );

                    await this.editor.edit(editBuilder => {
                        editBuilder.replace(rangeToEdit, newContent);
                    });

                    // TODO: make this much more robust
                    // This will break futur selections and edits
                    // if the length of the old and new cell contents are different
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