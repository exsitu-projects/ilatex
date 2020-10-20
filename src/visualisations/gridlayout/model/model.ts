import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTEnvironementNode, ASTNodeType, ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { InteractiveLaTeX } from "../../../core/InteractiveLaTeX";
import { WebviewManager } from "../../../core/webview/WebviewManager";
import { Grid, Row, Cell, GridExtractor } from "./GridExtractor";


class GridLayoutModel extends AbstractVisualisationModel<ASTEnvironementNode> {
    static readonly visualisationName = "gridlayout";
    readonly visualisationName = GridLayoutModel.visualisationName;

    private grid: Grid;

    // String of the last cell size (as it was written in the document)
    // This is required to avoid re-parsing the document when setting temporary sizes
    // (so that the value can be updated in real time during a drag-and-drop)
    private lastModifiedCellSize: string | null;

    constructor(node: ASTEnvironementNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, ilatex, editor, webviewManager);

        this.grid = this.extractGridFromASTNode();
        this.lastModifiedCellSize = null;
    }

    private extractGridFromASTNode(): Grid {
        const gridExtractor = new GridExtractor(this.editor.document);
        this.astNode.visitWith(gridExtractor);

        return gridExtractor.grid;        
    }

    private getRowAt(rowIndex: number): Row {
        return this.grid.rows[rowIndex];
    }

    private getCellAt(rowIndex: number, cellIndex: number): Cell {
        return this.getRowAt(rowIndex)
            .cells[cellIndex];
    }

    private async selectCell(cell: Cell): Promise<void> {
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

    private async resizeCell(cell: Cell, newRelativeSize: number): Promise<void> {
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
    }

    protected createContentAttributes(): Record<string, string> {
        return {
            ...super.createContentAttributes(),

            "data-loc-start": `${this.astNode.start.line};${this.astNode.start.column}`,
            "data-loc-end": `${this.astNode.end.line};${this.astNode.end.column}`
        };
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            ...super.createNotificationHandlerSpecifications(),

            {
                title: "select-cell-content",
                handler: async payload => {
                    // TODO: implement selection somewhere else
                    const { rowIndex, cellIndex } = payload;
                    const cell = this.getCellAt(rowIndex, cellIndex);
                    
                    await this.selectCell(cell);
                }
            },
            {
                title: "resize-cell",
                handler: async payload => {
                    const { rowIndex, cellIndex, newRelativeSize, isFinalSize } = payload;
                    const cell = this.getCellAt(rowIndex, cellIndex);

                    await this.resizeCell(cell, newRelativeSize);

                    // If this was the final size of this cell (i.e. if the resize handle was dropped),
                    // A new parsing of the document must be requested
                    // to generate new visualisations from the modified code
                    if (isFinalSize) {
                        this.requestNewParsing();
                    }
                }
            }
        ];
    }

    protected renderContentAsHTML(): string {
        return `
            <div class="layout">
                ${this.grid.rows.map(GridLayoutModel.renderRowAsHTML).join("\n")}
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
                    .map(cell => GridLayoutModel.renderCellAsHTML(cell))
                    .join("\n")
                }
            </div>
        `;
    }
}

export class GridLayoutModelFactory implements VisualisationModelFactory {
    readonly visualisationName = GridLayoutModel.visualisationName;
    readonly codePatternMatcher = (node: ASTNode) => {
        return node.type === ASTNodeType.Environement
            && node.name === "gridlayout";
    };

    createModel(node: ASTNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager): VisualisationModel {
        return new GridLayoutModel(node as ASTEnvironementNode, ilatex, editor, webviewManager);
    }
}