import "../../../webview/static-library-apis/interactjsApi";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { Cell } from "./Cell";
import { Row, RowResizeHandle } from "./Row";

export interface GridCallbacks {
    onGridResize: (grid: Grid, isFinalSize: boolean) => void;
    onRowAddButtonClick: () => void;
    onRowResize: (rowAbove: Row, rowBelow: Row, isFinalSize: boolean) => void;
    onCellResize: (leftCell: Cell, rightCell: Cell, isFinalSize: boolean) => void;
    onCellClick: (cell: Cell) => void;
    onCellDrop: (draggedCell: Cell, targetCell: Cell, side: "left" | "right") => void;
    onCellAddButtonClick: (cell: Cell, newCellLocation: "before" | "after") => void;
    onCellDeleteButtonClick: (cell: Cell) => void;
}

export class Grid {
    private viewContext: VisualisationViewContext;
    readonly node: HTMLElement;
    private rowContainerWrapperNode: HTMLElement;
    private rowContainerNode: HTMLElement;
    private commandBarNode: HTMLElement;
    
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

        // Create the node and populate it
        this.node = this.createGridNode();

        this.commandBarNode = this.createCommandBarNode();
        this.node.append(this.commandBarNode);

        this.rowContainerWrapperNode = this.createRowContainerWrapperNode();
        this.node.append(this.rowContainerWrapperNode);

        this.rowContainerNode = this.createRowContainerNode();
        this.rowContainerWrapperNode.append(this.rowContainerNode);

        this.populateRowContainerFrom(contentLayoutNode);
    }

    get cells(): Cell[] {
        return this.rows.reduce((accumulatedCells, row) => accumulatedCells.concat(row.cells), [] as Cell[]);
    }

    get sumOfAllRowRelativeSizes(): number {
        return this.rows.reduce(
            (sum, row) => sum + row.relativeSize,
            0
        );
    }

    private createGridNode(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("grid");

        return node;
    }

    private createCommandBarNode(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("command-bar");

        const instructionsNode = document.createElement("div");
        instructionsNode.classList.add("instructions");
        instructionsNode.innerHTML = `
            <strong>Hover</strong> a cell to display available actions.
            <strong>Click</strong> it to select its content.
            <strong>Drag</strong> it to move it.
        `;
        node.append(instructionsNode);

        const addRowButtonNode = document.createElement("button");
        addRowButtonNode.setAttribute("type", "button");
        addRowButtonNode.classList.add("add-row-button");
        addRowButtonNode.textContent = "Insert a new row";
        addRowButtonNode.addEventListener("click", event => {
            this.callbacks.onRowAddButtonClick();
        });
        node.append(addRowButtonNode);

        return node;
    }

    private createRowContainerWrapperNode(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("row-container-wrapper");

        return node;
    }

    private createRowContainerNode(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("row-container");

        return node;
    }

    private populateRowContainerFrom(contentLayoutNode: HTMLElement): void {
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
            this.rowContainerNode.append(row.node);

            // After each row but the last row of the grid,
            // create and add a row resize handle
            if (i < nbRowsInGrid - 1) {
                const rowResizeHandle = new RowResizeHandle(i);
                
                this.rowResizeHandles.push(rowResizeHandle);
                this.rowContainerNode.append(rowResizeHandle.node);
            }
        }
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

        this.rowContainerWrapperNode.style.width = `${scaledWidth}px`;
        this.rowContainerWrapperNode.style.height = `${scaledHeight}px`;

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
        for (let rowResizeHandle of this.rowResizeHandles) {
            const rowAbove = this.rows.find(cell => cell.rowIndex === rowResizeHandle.aboveRowIndex)!;
            const rowBelow = this.rows.find(cell => cell.rowIndex === rowResizeHandle.belowRowIndex)!;

            interact(rowResizeHandle.node).draggable({
                startAxis: "y",
                lockAxis: "y",

                listeners: {
                    move: (event: any) => {
                        this.onRowResizeHandleDrag(rowResizeHandle, event.dy);
                    }
                },
            })
            .on("dragmove", () => {
                this.callbacks.onRowResize(rowAbove, rowBelow, false);
            })
            .on("dragend", () => {
                this.callbacks.onRowResize(rowAbove, rowBelow, true);
            });
        }
    }

    private stopHandlingRowResizeHandleDrags(): void {
        for (let rowResizeHandle of this.rowResizeHandles) {
            interact(rowResizeHandle.node).unset();
        }
    }

    private startHandlingCellDrags(): void {
        let draggedCell: Cell | null = null;

        const cells = this.cells;
        for (let cell of cells) {
            interact(cell.draggableNode).draggable({
                listeners: {
                    start: (event: any) => {
                        draggedCell = cell;

                        this.node.classList.add("cell-is-dragged");
                        cell.node.classList.add("dragged");
                    },

                    end: (event: any) => {
                        draggedCell = null;

                        this.node.classList.remove("cell-is-dragged");
                        cell.node.classList.remove("dragged");
                    },
                },
            });

            // To avoid interferences between standard OM event listeners and interact.js,
            // this listerner is created via interact.js here and now
            interact(cell.draggableNode).on("tap", (event: any) => {
                this.callbacks.onCellClick(cell);
            });

            interact(cell.leftCellDropZoneNode).dropzone({
                listeners: {
                    drop: (event: any) => {
                        if (draggedCell !== null) {
                            this.callbacks.onCellDrop(draggedCell, cell, "left");
                        }
                    }
                },
            });

            interact(cell.rightCellDropZoneNode).dropzone({
                listeners: {
                    drop: (event: any) => {
                        if (draggedCell !== null) {
                            this.callbacks.onCellDrop(draggedCell, cell, "right");
                            return;
                        }
                    }
                },
            });
        }
    }

    private stopHandlingCellDrags(): void {
        const cells = this.cells;
        for (let cell of cells) {
            interact(cell.draggableNode).unset();
            interact(cell.leftCellDropZoneNode).unset();
            interact(cell.rightCellDropZoneNode).unset();
        }
    }

    onAfterVisualisationDisplay(): void {
        this.startHandlingRowResizeHandleDrags();
        this.startHandlingCellDrags();
        this.resize();
        
        for (let row of this.rows) {
            row.onAfterVisualisationDisplay();
        }
    }

    onBeforeVisualisationRemoval(): void {
        this.stopHandlingRowResizeHandleDrags();
        this.stopHandlingCellDrags();

        for (let row of this.rows) {
            row.onBeforeVisualisationRemoval();
        }
    }    
}