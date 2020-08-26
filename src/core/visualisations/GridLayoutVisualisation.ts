import * as vscode from "vscode";
import * as P from "parsimmon";
import { Visualisation, WebviewNotificationHandlerSpecification } from "./Visualisation";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";
import { LatexLength } from "../utils/LatexLength";
import { ASTEnvironementNode, ASTCommandNode, ASTNode, ASTParameterNode } from "../ast/LatexASTNode";
import { InteractiveLaTeX } from "../InteractiveLaTeX";
import { WebviewManager } from "../webview/WebviewManager";

interface Cell {
    rowIndex: number;
    cellIndex: number;
    node: ASTEnvironementNode,
    textContent: string;
    options: {
        relativeSize: number;
    }
}

interface Row {
    rowIndex: number;
    node: ASTEnvironementNode,
    cells: Cell[];
    options: {
        height: LatexLength;
    }
};

interface GridLayout {
    content: Row[];
    options: {
        width?: LatexLength;
    }
}

class GridLayoutContentReader extends LatexASTVisitorAdapter {
    private gridLayout: GridLayout;
    private document: vscode.TextDocument;
    
    private currentRow: Row | null;
    private currentRowIndex: number;
    private currentCellIndex: number;

    constructor(gridLayout: GridLayout, document: vscode.TextDocument) {
        super();
        this.gridLayout = gridLayout;
        this.document = document;

        this.currentRow = null;
        this.currentRowIndex = -1;
        this.currentCellIndex = -1;
    }

    private createNewRow(rowNode: ASTEnvironementNode): Row {
        this.currentRowIndex += 1;
        this.currentCellIndex = -1;

        const rowHeightParameter = rowNode.value.parameters[0][0] as ASTParameterNode;
        const rowHeight = LatexLength.from(rowHeightParameter.value);

        return {
            rowIndex: this.currentRowIndex,
            node: rowNode,
            cells: [],
            options: {
                height: rowHeight
            }
        };
    }

    private createNewCell(cellNode: ASTEnvironementNode): Cell {
        this.currentCellIndex += 1;

        const cellRelativeSizeParameter = cellNode.value.parameters[0][0] as ASTParameterNode;
        const relativeSize = parseFloat(cellRelativeSizeParameter.value);
        
        return {
            rowIndex: this.currentRowIndex,
            cellIndex: this.currentCellIndex,
            node: cellNode,
            textContent: this.getCellContent(
                cellNode.value.content.start,
                cellNode.value.content.end
            ),
            options: {
                relativeSize: relativeSize
            }
        };        
    }

    private getCellContent = (start: P.Index, end: P.Index): string => {
        return this.document.getText(new vscode.Range(
            new vscode.Position(start.line - 1, start.column - 1),
            new vscode.Position(end.line - 1, end.column - 1)
        ));
    };

    protected visitEnvironementNode(node: ASTEnvironementNode) {
        // Every row environment inside a gridlayout environement starts a new row
        if (node.name === "row") {
            const newRow = this.createNewRow(node);

            this.currentRow = newRow;
            this.gridLayout.content.push(newRow);
        }

        // Every cell environment inside a gridlayout environement starts a new cell (in the current row)
        if (node.name === "cell") {
            const newCell = this.createNewCell(node);
            this.currentRow?.cells.push(newCell);
        }
    }
}


export class GridLayoutVisualisation extends Visualisation<ASTEnvironementNode> {
    readonly name = "gridlayout";

    private gridLayout: GridLayout;

    // String of the last cell size (as it was written in the document)
    // This is required to avoid re-parsing the document when setting temporary sizes
    // (so that the value can be updated in real time during a drag-and-drop)
    private lastModifiedCellSize: string | null;
    
    constructor(node: ASTEnvironementNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, ilatex, editor, webviewManager);

        this.gridLayout = {
            content: [],
            options: {}
        };

        this.lastModifiedCellSize = null;

        this.extractGridLayout();
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

    private getRowAt(rowIndex: number): Row {
        return this.gridLayout.content[rowIndex];
    }

    private getCellAt(rowIndex: number, cellIndex: number): Cell {
        return this.getRowAt(rowIndex)
            .cells[cellIndex];
    }

    protected getWebviewNotificationHandlerSpecifications(): WebviewNotificationHandlerSpecification[] {
        return [
            ...super.getWebviewNotificationHandlerSpecifications(),

            {
                subject: "select-cell-content",
                handler: async payload => {
                    // TODO: implement selection somewhere else
                    const { rowIndex, cellIndex } = payload;
                    const cell = this.getCellAt(rowIndex, cellIndex);
                    const cellContentNode = cell.node.value.content;

                    // Select the code
                    const startPosition = new vscode.Position(cellContentNode.start.line - 1, cellContentNode.start.column - 1);
                    const endPosition = new vscode.Position(cellContentNode.end.line - 1, cellContentNode.end.column - 1);
                    this.editor.selections = [new vscode.Selection(startPosition, endPosition)];

                    // If the selected range is not visible, scroll to the selection
                    this.editor.revealRange(
                        new vscode.Range(startPosition, endPosition),
                        vscode.TextEditorRevealType.InCenterIfOutsideViewport
                    );
                }
            },
            {
                subject: "resize-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex, newRelativeSize, isFinalSize } = payload;
                    const cell = this.getCellAt(rowIndex, cellIndex);
                    const cellSizeParameterNode = cell.node.value.parameters[0][0] as ASTParameterNode;

                    // Bound the number of decimals of the new size
                    const maxNbDecimals = 3;
                    const tenPowerNbDecimals = 10 ** maxNbDecimals;
                    const newSizeAsString = ((Math.round(newRelativeSize * tenPowerNbDecimals)) / tenPowerNbDecimals).toString();

                    // If the value has been changed since the current AST was generated,
                    // use the last value to compute the end of the range to edit
                    // Note: in this case, we know that the beginning and the end of the range are on the same line!
                    const editRangeEndLine = this.lastModifiedCellSize === null
                                           ? cellSizeParameterNode.end.line - 1
                                           : cellSizeParameterNode.start.line - 1;
                    const editRangeEndColumn = this.lastModifiedCellSize === null
                                             ? cellSizeParameterNode.end.column - 1
                                             : cellSizeParameterNode.start.column - 1 + this.lastModifiedCellSize.length;

                    const rangeToEdit = new vscode.Range(
                        cellSizeParameterNode.start.line - 1, cellSizeParameterNode.start.column - 1,
                        editRangeEndLine, editRangeEndColumn
                    );

                    // Update the copy of the last modified size
                    this.lastModifiedCellSize = newSizeAsString;
                        
                    // console.log("======== Replacement ========");
                    // console.log("REPLACE: ", this.editor.document.getText(rangeToEdit));
                    // console.log("BY", newSizeAsString);

                    // Actually perform the edit
                    await this.editor.edit(editBuilder => {
                        editBuilder.replace(rangeToEdit, newSizeAsString);
                    });

                    // If this was the final size of this cell (i.e. if the resize handle was dropped),
                    // require a new parsing of the document
                    if (isFinalSize) {
                        this.requestNewParsing();
                    }
                }
            }
        ];
    }

    private extractGridLayoutOptions(): void {
        if (this.node.value.parameters[0].length > 0) {
            const parameterNode = this.node.value.parameters[0][0] as ASTParameterNode;
            this.gridLayout.options.width = LatexLength.from(parameterNode.value);
        }
    }

    private extractGridLayoutContent(): void {
        const gridLayoutContentReader = new GridLayoutContentReader(this.gridLayout, this.editor.document);
        this.node.value.content.visitWith(gridLayoutContentReader);
    }

    private extractGridLayout(): void {
        this.extractGridLayoutOptions();
        this.extractGridLayoutContent();

        console.log("grid layout has been extracted");
        console.log(this.gridLayout);
    }
    
    renderContentAsHTML(): string {
        return `
            <div class="layout">
                ${this.gridLayout.content.map(GridLayoutVisualisation.renderRowAsHTML).join("\n")}
            </div>
        `;
    }

    private static renderCellAsHTML(cell: Cell): string {
        function getAttributesAsHTML(cell: Cell) {
            const attributes = {
                "class": "cell",
                "data-row": cell.rowIndex,
                "data-cell": cell.cellIndex,
                "data-relative-size": cell.options.relativeSize
            };
            
            return Object.entries(attributes)
                .map(([key, value]) => `${key}="${value}"`)
                .join(" ");
        }

        return `<div ${getAttributesAsHTML(cell)}>${cell.textContent}</div>`;
    }

    private static renderRowAsHTML(row: Row): string {
        return `
            <div class="row" data-height="${row.options.height.px}">
                ${row.cells
                    .map(cell => GridLayoutVisualisation.renderCellAsHTML(cell))
                    .join("\n")
                }
            </div>
        `;
    }
}