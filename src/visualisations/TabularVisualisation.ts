import * as vscode from "vscode";
import * as P from "parsimmon";
import { Visualisation } from "./Visualisation";
import { ASTEnvironementNode, ASTNode, ASTNodeType, ASTCommandNode, ASTSpecialSymbolNode, ASTParameterNode, ASTLatexNode } from "../ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";

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

class TabularGridSetter extends LatexASTVisitorAdapter {
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

    // TODO: implement this feature elsewhere
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
        if (commandName === "\\\\") {
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

    private document: vscode.TextDocument;
    private tabular: Tabular;
    
    constructor(node: ASTEnvironementNode, document: vscode.TextDocument) {
        super(node);

        this.document = document;
        this.tabular = {
            grid: [],
            options: {
                columns: []
            }
        };

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

    private extractTabularGrid(contentNode: ASTLatexNode): void {
        const gridSetter = new TabularGridSetter(this.tabular.grid, this.document);
        for (let node of contentNode.value) {
            node.visitWith(gridSetter, 0, 0);
        }

        // Ensure the last cell of the grid is not forgotten
        // (in case the last node of the env. content is part of a call)
        if (!gridSetter.isCurrentCellEmpty()) {
            gridSetter.addCurrentCellToGrid();
        }
    }

    private extractTabularOptions(node: ASTParameterNode): void {
        try {
            const columns = tabularColumnOptionLanguage.columns.tryParse(node.value);
            this.tabular.options.columns = columns;
        }
        catch (error) {
            console.error("Error during tabular option parsing:", error);
        }
    }

    private extractTabular(): void {
        this.extractTabularGrid(this.node.value.content as ASTLatexNode);
        this.extractTabularOptions(this.node.value.parameters[0][0] as ASTParameterNode);
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
                "data-loc-start": `${cell.start.line};${cell.start.column}`,
                "data-loc-end": `${cell.end.line};${cell.end.column}`
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