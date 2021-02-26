import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { TaskThrottler } from "../../../shared/tasks/TaskThrottler";
import { VisualisationMetadata } from "../../../shared/visualisations/types";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { Grid } from "./Grid";
import { Cell } from "./Cell";
import { Row } from "./Row";

class GridLayoutView extends AbstractVisualisationView {
    static readonly visualisationName = "grid layout";
    private static readonly DELAY_BETWEEN_RESIZES = 50; // ms

    readonly visualisationName = GridLayoutView.visualisationName;
    private grid: Grid;

    private resizeThrottler: TaskThrottler;

    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext) {
        super(contentNode, metadata, context);

        this.grid = this.createGrid();

        // Internal values used during cell and row resizing
        this.resizeThrottler = new TaskThrottler(GridLayoutView.DELAY_BETWEEN_RESIZES);
    }

    private createGrid(): Grid {
        const callbacks = {
            onGridResize: (grid: Grid, isFinalSize: boolean) => {
                // TODO
            },
            onRowResize: (rowAbove: Row, rowBelow: Row, isFinalSize: boolean) => {
                this.resizeRows(rowAbove, rowBelow, isFinalSize);
            },
            onCellResize: (leftCell: Cell, rightCell: Cell, isFinalSize: boolean) => {
                this.resizeCells(leftCell, rightCell, isFinalSize);
            },
            onCellContentClick: (cell: Cell) => {
                this.selectContentOfCell(cell);
            },
        };

        return new Grid(
            this.contentNode.querySelector(".layout")! as HTMLElement,
            this.instanciationContext,
            callbacks
        );
    }

    private selectContentOfCell(cell: Cell) {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "select-cell-content",
            notification: {
                cellIndex: cell.cellIndex,
                rowIndex: cell.rowIndex
            }
        });
    }

    private resizeCells(leftCell: Cell, rightCell: Cell, isFinalSize: boolean): void {
        this.resizeThrottler.add(async () => {
            this.messenger.sendMessage({
                type: WebviewToCoreMessageType.NotifyVisualisationModel,
                visualisationUid: this.modelUid,
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

    private resizeRows(rowAbove: Row, rowBelow: Row, isFinalSize: boolean): void {
        this.resizeThrottler.add(async () => {
            this.messenger.sendMessage({
                type: WebviewToCoreMessageType.NotifyVisualisationModel,
                visualisationUid: this.modelUid,
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

    onAfterVisualisationDisplay(): void {
        this.grid.onAfterVisualisationDisplay();
    }

    onBeforeVisualisationRemoval(): void {
        this.grid.onBeforeVisualisationRemoval();
    }

    onAfterVisualisationErrorRemoval(): void {
        this.grid.resize();
    }

    render(): HTMLElement {
        return this.grid.node;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;

        this.grid.onBeforeVisualisationRemoval();
        this.grid = this.createGrid();
        this.grid.onAfterVisualisationDisplay();
    }
}

export class GridLayoutViewFactory implements VisualisationViewFactory {
    readonly visualisationName = GridLayoutView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext): VisualisationView {
        return new GridLayoutView(contentNode, metadata, context);
    }
}