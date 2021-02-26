import "../../../webview/static-library-apis/interactjsApi";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { Cell } from "./Cell";
import { Row, RowResizeHandle } from "./Row";

export interface GridCallbacks {
    onGridResize: (grid: Grid, isFinalSize: boolean) => void;
    onRowResize: (row: Row, isFinalSize: boolean) => void;
    onCellResize: (cell: Cell, isFinalSize: boolean) => void;
    onCellContentClick: (cell: Cell) => void;
}

export class Grid {
    private viewContext: VisualisationViewContext;
    readonly node: HTMLElement;
    
    readonly rows: Row[];
    readonly rowResizeHandles: RowResizeHandle[];

    private initialWidth: number;
    private initialHeight: number;
    private currentWidth: number;
    private currentHeight: number;

    private callbacks: GridCallbacks;

    constructor(
        contentLayoutNode: HTMLElement,
        viewContext: VisualisationViewContext,
        callbacks: GridCallbacks
    ) {
        this.viewContext = viewContext;

        this.rows = [];
        this.rowResizeHandles = [];

        this.initialWidth = parseFloat(contentLayoutNode.getAttribute("data-width")!);
        this.initialHeight = parseFloat(contentLayoutNode.getAttribute("data-height")!);

        this.currentWidth = this.initialWidth;
        this.currentHeight = this.initialHeight;

        this.callbacks = callbacks;

        // Create the node and populate the grid
        this.node = this.createGridNodeFrom();
        this.populateWithRowsAndRowResizeHandlesFrom(contentLayoutNode);
    }

    get sumOfAllRowRelativeSizes(): number {
        return this.rows.reduce(
            (sum, row) => sum + row.relativeSize,
            0
        );
    }

    private createGridNodeFrom(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("grid");

        return node;
    }

    private populateWithRowsAndRowResizeHandlesFrom(contentLayoutNode: HTMLElement): void {
        const rowContainerNode = document.createElement("div");
        rowContainerNode.classList.add("row-container");

        const contentRowNodes = Array.from(contentLayoutNode.querySelectorAll(".row"));
        const nbRowsInGrid = contentRowNodes.length;

        for (let i = 0; i < nbRowsInGrid; i++) {
            const contentRowNode = contentRowNodes[i] as HTMLElement;

            // Create and add a new row
            const row = new Row(
                contentRowNode,
                nbRowsInGrid,
                this.viewContext,
                this.callbacks
            );
            
            this.rows.push(row);
            rowContainerNode.append(row.node);

            // After each row but the last row of the grid,
            // create and add a row resize handle
            if (i < nbRowsInGrid - 1) {
                const rowResizeHandle = new RowResizeHandle(i);
                
                this.rowResizeHandles.push(rowResizeHandle);
                rowContainerNode.append(rowResizeHandle.node);
            }
        }

        this.node.append(rowContainerNode);
    }

    resizeRowsAndCells(): void {
        const relativeRowSizeScale = 1 / this.sumOfAllRowRelativeSizes;
        for (let row of this.rows) {
            row.relativeSizeScale = relativeRowSizeScale;
            row.resize();
            row.resizeCells();
        }
    }

    resize(): void {
        const pdfPageScale = this.viewContext.pdfPageDetail?.scale;
        if (!pdfPageScale) {
            console.warn("The size of the grid cannot be updated: the PDF page scale could not be retrieved.");
            return;
        }

        const scaledWidth = this.currentWidth * pdfPageScale;
        const scaledHeight = this.currentHeight * pdfPageScale;

        this.node.style.width = `${scaledWidth}px`;
        this.node.style.height = `${scaledHeight}px`;

        this.resizeRowsAndCells();
    }


    private onRowResizeHandleDrag(handle: RowResizeHandle, dy: number): void {
        if (dy === 0) {
            return;
        }

        const rowAbove = this.rows.find(cell => cell.rowIndex === handle.aboveRowIndex)!;
        const rowBelow = this.rows.find(cell => cell.rowIndex === handle.belowRowIndex)!;
        
        // If dy is positive, grow the relative size of all the row above the dragged handle
        // and shrink the relative size of the row below
        // If dy is negative, do the opposite
        // In case the future size of the row to shrink is too small, abort and do nothing
        const rowAboveHeight = rowAbove.node.clientHeight;
        const rowBelowHeight = rowBelow.node.clientHeight;
        const rowAboveSizeChangeRatio = (rowAboveHeight + dy) / rowAboveHeight;
        const rowBelowSizeChangeRatio = (rowBelowHeight - dy) / rowBelowHeight;

        if (rowAboveHeight * rowAboveSizeChangeRatio < 25
        ||  rowBelowHeight * rowBelowSizeChangeRatio < 25) {
            return;
        }

        rowAbove.resizeToRelativeSize(rowAbove.relativeSize * rowAboveSizeChangeRatio);
        rowBelow.resizeToRelativeSize(rowBelow.relativeSize * rowBelowSizeChangeRatio);
    }

    private startHandlingRowResizeHandleDrags(): void {
        debugger;
        for (let rowResizeHandle of this.rowResizeHandles) {
            interact(rowResizeHandle.node)
                .draggable({
                    startAxis: "y",
                    lockAxis: "y",

                    listeners: {
                        move: (event: any) => {
                            this.onRowResizeHandleDrag(rowResizeHandle, event.dy);
                        }
                    },
                })
                .on("dragmove", () => { })
                .on("dragend", () => { });
        }
    }

    private stopHandlingRowResizeHandleDrags(): void {
        for (let rowResizeHandle of this.rowResizeHandles) {
            interact(rowResizeHandle.node).unset();
        }
    }

    onAfterVisualisationDisplay(): void {
        this.startHandlingRowResizeHandleDrags();
        this.resize();
        
        for (let row of this.rows) {
            row.onAfterVisualisationDisplay();
        }
    }

    onBeforeVisualisationRemoval(): void {
        this.stopHandlingRowResizeHandleDrags();

        for (let row of this.rows) {
            row.onBeforeVisualisationRemoval();
        }
    }    
}