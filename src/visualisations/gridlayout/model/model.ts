import * as vscode from "vscode";
import { VisualisationModelFactory, VisualisationModel, VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTEnvironementNode, ASTNodeType, ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { Cell, Layout, Row } from "./Layout";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";
import { SourceFile } from "../../../core/mappings/SourceFile";
import { CodeMapping } from "../../../core/mappings/CodeMapping";


class GridLayoutModel extends AbstractVisualisationModel<ASTEnvironementNode> {
    static readonly visualisationName = "gridlayout";
    readonly visualisationName = GridLayoutModel.visualisationName;

    private layout: Layout;

    // String of the last cell size/row height (as it was written in the document)
    // This is required to avoid re-parsing the document when setting temporary dimensions
    // (so that the value can be updated in real time during a drag-and-drop)
    private lastModifiedCellSize: string | null;
    private lastModifiedRowHeight: string | null;

    constructor(node: ASTEnvironementNode, mapping: CodeMapping, utilities: VisualisationModelUtilities) {
        super(node, mapping, utilities);

        this.layout = Layout.extractFrom(node, mapping.sourceFile.document);
        this.lastModifiedCellSize = null;
        this.lastModifiedRowHeight = null;
    }

    private getRowAt(rowIndex: number): Row {
        return this.layout.rows[rowIndex];
    }

    private getCellAt(rowIndex: number, cellIndex: number): Cell {
        return this.getRowAt(rowIndex)
            .cells[cellIndex];
    }

    private async selectCell(cell: Cell): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();

        // Select the code
        const startPosition = new vscode.Position(cell.start.line - 1, cell.start.column - 1);
        const endPosition = new vscode.Position(cell.end.line - 1, cell.end.column - 1);
        editor.selections = [new vscode.Selection(startPosition, endPosition)];

        // If the selected range is not visible, scroll to the selection
        editor.revealRange(
            new vscode.Range(startPosition, endPosition),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
    }

    private async resizeCell(cell: Cell, newRelativeSize: number): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();
        const cellSizeParameterNode = cell.astNode.value.parameters[0][0] as ASTParameterNode;

        // Round the number of decimals of the new size
        const maxNbDecimals = 3;
        const tenPowerNbDecimals = 10 ** maxNbDecimals;
        const newSizeAsString =
            ((Math.round(newRelativeSize * tenPowerNbDecimals)) / tenPowerNbDecimals)
                .toString();

        // If the value has been changed since the current AST was generated,
        // use the last value to compute the end of the range to edit
        // Note: we assume the beginning and the end of the range are located on the same line!
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

        // Actually perform the edit
        await editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, newSizeAsString);
        });
    }

    private async resizeRow(row: Row, newHeight: number): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();
        const rowHeightParameterNode = row.astNode.value.parameters[0][0] as ASTParameterNode;

        // Round the new height and append the right suffix
        const newHeightAsString = `${Math.round(newHeight)}px`;

        // If the value has been changed since the current AST was generated,
        // use the last value to compute the end of the range to edit
        // Note: in this case, we know that the beginning and the end of the range are on the same line!
        const editRangeEndLine = this.lastModifiedRowHeight === null
                               ? rowHeightParameterNode.end.line - 1
                               : rowHeightParameterNode.start.line - 1;
        const editRangeEndColumn = this.lastModifiedRowHeight === null
                                 ? rowHeightParameterNode.end.column - 1
                                 : rowHeightParameterNode.start.column - 1 + this.lastModifiedRowHeight.length;

        const rangeToEdit = new vscode.Range(
            rowHeightParameterNode.start.line - 1, rowHeightParameterNode.start.column - 1,
            editRangeEndLine, editRangeEndColumn
        );

        // Update the copy of the last modified size
        this.lastModifiedRowHeight = newHeightAsString;

        // Actually perform the edit
        await editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, newHeightAsString);
        });
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            ...super.createNotificationHandlerSpecifications(),

            {
                title: "select-cell-content",
                handler: async payload => {
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
            },
            {
                title: "resize-row",
                handler: async payload => {
                    const { rowIndex, newHeight, isFinalSize } = payload;
                    const row = this.getRowAt(rowIndex);

                    await this.resizeRow(row, newHeight);

                    // If this was the final size of this row (i.e. if the resize handle was dropped),
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
                ${this.layout.rows.map(GridLayoutModel.renderRowAsHTML).join("\n")}
            </div>
        `;
    }

    private static renderCellAsHTML(cell: Cell): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "class": "cell",
            "data-row": cell.rowIndex.toString(),
            "data-cell": cell.cellIndex.toString(),
            "data-relative-size": cell.options.relativeSize.toString()
        });

        return `<div ${attributes}>${cell.textContent}</div>`;
    }

    private static renderRowAsHTML(row: Row): string {
        const attributes = HtmlUtils.makeAttributesFromKeysOf({
            "class": "row",
            "data-row": row.rowIndex.toString(),
            "data-height": row.options.height.px.toString(),
        });

        return `
            <div ${attributes}>
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
    readonly astMatchingRule = (node: ASTNode) => {
        return node.type === ASTNodeType.Environement
            && node.name === "gridlayout";
    };

    createModel(node: ASTNode, mapping: CodeMapping, utilities: VisualisationModelUtilities): VisualisationModel {
        return new GridLayoutModel(node as ASTEnvironementNode, mapping, utilities);
    }
}