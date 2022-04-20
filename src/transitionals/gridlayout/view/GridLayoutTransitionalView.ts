import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { TaskThrottler } from "../../../shared/tasks/TaskThrottler";
import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { Grid } from "./Grid";
import { Cell } from "./Cell";
import { Row } from "./Row";
import { TransitionalView } from "../../../webview/transitionals/TransitionalView";

export class GridLayoutTransitionalView extends TransitionalView {
    static readonly transitionalName = "grid layout";
    private static readonly DELAY_BETWEEN_RESIZES = 50; // ms

    readonly transitionalName = GridLayoutTransitionalView.transitionalName;
    private grid: Grid;

    private resizeThrottler: TaskThrottler;

    constructor(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext) {
        super(contentNode, metadata, context);

        this.grid = this.createGrid();

        // Internal values used during cell and row resizing
        this.resizeThrottler = new TaskThrottler(GridLayoutTransitionalView.DELAY_BETWEEN_RESIZES);
    }

    private createGrid(): Grid {
        const callbacks = {
            onGridResize: (grid: Grid, isFinalSize: boolean) => {
                // TODO
            },
            onRowAddButtonClick: () => {
                // Create a new bottom row by default
                this.createRow(this.grid.rows.length);
            },
            onRowResize: (rowAbove: Row, rowBelow: Row, isFinalSize: boolean) => {
                this.resizeRows(rowAbove, rowBelow, isFinalSize);
            },
            onCellResize: (leftCell: Cell, rightCell: Cell, isFinalSize: boolean) => {
                this.resizeCells(leftCell, rightCell, isFinalSize);
            },
            onCellClick: (cell: Cell) => {
                this.selectContentOfCell(cell);
            },
            onCellDrop: (draggedCell: Cell, targetCell: Cell, side: "left" | "right") => {
                this.moveCell(
                    draggedCell,
                    targetCell.rowIndex,
                    side === "left" ? targetCell.cellIndex : targetCell.cellIndex + 1
                );
            },
            onCellAddButtonClick: (cell: Cell, newCellLocation: "before" | "after") => {
                this.createCellNextTo(cell, newCellLocation);
            },
            onCellDeleteButtonClick: (cell: Cell) => {
                this.deleteCell(cell);
            },
        };

        return new Grid(
            this.contentNode.querySelector(".layout")! as HTMLElement,
            this.context,
            callbacks
        );
    }

    private selectContentOfCell(cell: Cell) {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.modelUid,
            title: "select-cell-content",
            notification: {
                cellIndex: cell.cellIndex,
                rowIndex: cell.rowIndex
            }
        });
    }

    private createRow(newRowIndex: number): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.modelUid,
            title: "create-row",
            notification: {
                rowIndex: newRowIndex
            }
        });
    }

    private resizeRows(rowAbove: Row, rowBelow: Row, isFinalSize: boolean): void {
        this.resizeThrottler.add(async () => {
            this.messenger.sendMessage({
                type: WebviewToCoreMessageType.NotifyTransitionalModel,
                transitionalUid: this.modelUid,
                title: "resize-rows",
                notification: {
                    rowAboveChange: {
                        rowIndex: rowAbove.rowIndex,
                        newRelativeSize: rowAbove.relativeSize
                    },
                    rowBelowChange: {
                        rowIndex: rowBelow.rowIndex,
                        newRelativeSize: rowBelow.relativeSize
                    },
                    isFinalSize: isFinalSize
                }
            });
        });
    }

    private resizeCells(leftCell: Cell, rightCell: Cell, isFinalSize: boolean): void {
        this.resizeThrottler.add(async () => {
            this.messenger.sendMessage({
                type: WebviewToCoreMessageType.NotifyTransitionalModel,
                transitionalUid: this.modelUid,
                title: "resize-cells",
                notification: {
                    leftCellChange: {
                        rowIndex: leftCell.rowIndex,
                        cellIndex: leftCell.cellIndex,
                        newRelativeSize: leftCell.relativeSize
                    },
                    rightCellChange: {
                        rowIndex: rightCell.rowIndex,
                        cellIndex: rightCell.cellIndex,
                        newRelativeSize: rightCell.relativeSize
                    },
                    isFinalSize: isFinalSize
                }
            });    
        });
    }

    private createCellNextTo(cell: Cell, position: "before" | "after"): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.modelUid,
            title: "create-cell",
            notification: {
                rowIndex: cell.rowIndex,
                cellIndex: position === "before" ? cell.cellIndex : cell.cellIndex + 1
            }
        });
    }

    private moveCell(cell: Cell, targetRowIndex: number, targetCellIndex: number): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.modelUid,
            title: "move-cell",
            notification: {
                rowIndex: cell.rowIndex,
                cellIndex: cell.cellIndex,
                targetRowIndex: targetRowIndex,
                targetCellIndex: targetCellIndex
            }
        });
    }

    private deleteCell(cell: Cell): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyTransitionalModel,
            transitionalUid: this.modelUid,
            title: "delete-cell",
            notification: {
                rowIndex: cell.rowIndex,
                cellIndex: cell.cellIndex
            }
        });
    }

    onAfterTransitionalDisplay(): void {
        super.onAfterTransitionalDisplay();

        this.grid.onAfterTransitionalDisplay();
    }

    onBeforeTransitionalRemoval(): void {
        super.onBeforeTransitionalRemoval();

        this.grid.onBeforeTransitionalRemoval();
    }

    onAfterTransitionalErrorRemoval(): void {
        super.onAfterTransitionalErrorRemoval();

        this.grid.resize();
    }

    onAfterPdfResize(): void {
        super.onAfterPdfResize();
        
        this.grid.resize();
    }

    render(): HTMLElement {
        return this.grid.node;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;

        this.grid.onBeforeTransitionalRemoval();
        this.grid = this.createGrid();
        this.grid.onAfterTransitionalDisplay();
    }
}
