import "../../../webview/static-library-apis/interactjsApi";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { Cell, CellResizeHandle } from "./Cell";
import { GridCallbacks } from "./Grid";

export class RowResizeHandle {
    readonly node: HTMLElement;

    readonly aboveRowIndex: number;
    readonly belowRowIndex: number;

    constructor(aboveRowIndex: number) {
        this.aboveRowIndex = aboveRowIndex;
        this.belowRowIndex = aboveRowIndex + 1;

        this.node = this.createRowResizeHandleNodeFrom();
    }

    private createRowResizeHandleNodeFrom(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("row-resize-handle");
        node.setAttribute("data-above-row-index", this.aboveRowIndex.toString());
        node.setAttribute("data-below-row-index", this.belowRowIndex.toString());

        return node;
    }
}

export class Row {
    private viewContext: VisualisationViewContext;
    readonly node: HTMLElement;
    
    readonly cells: Cell[];
    readonly cellResizeHandles: CellResizeHandle[];
    readonly rowIndex: number;

    private initialRelativeSize: number;
    private currentRelativeSize: number;
    private nbRowsInGrid: number;
    relativeSizeScale: number;

    private callbacks: GridCallbacks;

    constructor(
        rowContentNode: HTMLElement,
        nbRowsInGrid: number,
        viewContext: VisualisationViewContext,
        callbacks: GridCallbacks
    ) {
        this.viewContext = viewContext;

        this.cells = [];
        this.cellResizeHandles = [];
        this.rowIndex = parseInt(rowContentNode.getAttribute("data-row-index")!);
        this.relativeSizeScale = 1;
        
        this.initialRelativeSize = parseFloat(rowContentNode.getAttribute("data-relative-size")!);
        this.currentRelativeSize = this.initialRelativeSize;
        this.nbRowsInGrid = nbRowsInGrid;
        
        this.callbacks = callbacks;

        // Create the node and populate the row
        this.node = this.createRowNodeFrom();
        this.populateWithCellsAndCellResizeHandlesFrom(rowContentNode);
    }

    get nbCells(): number {
        return this.cells.length;
    }

    get relativeSize(): number {
        return this.currentRelativeSize;
    }

    get scaledRelativeSize(): number {
        return this.currentRelativeSize * this.relativeSizeScale;
    }

    get sumOfAllCellRelativeSizes(): number {
        return this.cells.reduce(
            (sum, cell) => sum + cell.relativeSize,
            0
        );
    }

    private createRowNodeFrom(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("row");
        node.setAttribute("data-row-index", this.rowIndex.toString());

        return node;
    }

    private populateWithCellsAndCellResizeHandlesFrom(contentRowNode: HTMLElement): void {
        const cellContainerNode = document.createElement("div");
        cellContainerNode.classList.add("cell-container");

        const contentCellNodes = Array.from(contentRowNode.querySelectorAll(".cell"));
        const nbCellsInRow = contentCellNodes.length;

        for (let i = 0; i < nbCellsInRow; i++) {
            const contentCellNode = contentCellNodes[i] as HTMLElement;

            // Create and add a new cell
            const cell = new Cell(
                contentCellNode,
                nbCellsInRow,
                this.viewContext,
                this.callbacks
            );
            
            this.cells.push(cell);
            cellContainerNode.append(cell.node);

            // After each cell but the last cell of the row,
            // create and add a cell resize handle
            if (i < nbCellsInRow - 1) {
                const cellResizeHandle = new CellResizeHandle(i);
                
                this.cellResizeHandles.push(cellResizeHandle);
                cellContainerNode.append(cellResizeHandle.node);
            }
        }

        this.node.append(cellContainerNode);
    }

    resizeCells(): void {
        const relativeCellSizeScale = 1 / this.sumOfAllCellRelativeSizes;
        for (let cell of this.cells) {
            cell.relativeSizeScale = relativeCellSizeScale;
            cell.resize();
        }
    }

    // This method assumes the distribution of relative size is valid,
    // i.e. the sum over all the rows of the grid is equal to 1
    resize(): void {
        const parentNode = this.node.parentElement;
        if (!parentNode) {
            console.warn(`The size of the row node at index ${this.rowIndex} cannot be updated: it has no parent node.`);
            return;
        }

        const parentNodeBox = parentNode.getBoundingClientRect();
        const rowResizeHandleHeight = 8; // px
        const totalHeightOfAllRowResizeHandles = (this.nbRowsInGrid - 1) * rowResizeHandleHeight;
        const newAbsoluteSize = Math.max(0, parentNodeBox.height - totalHeightOfAllRowResizeHandles) * this.currentRelativeSize;

        this.node.style.height = `calc((100% - ${totalHeightOfAllRowResizeHandles}px) * ${this.currentRelativeSize})`;
    }

    resizeToRelativeSize(newRelativeSize: number): void {
        this.currentRelativeSize = newRelativeSize;
        this.resize();
    }

    // TODO: handle minimum size
    private distributeCellSizeChangeOn(cells: Cell[], differenceInPx: number): void {
        const widthSum = cells.reduce((sum, cell) => sum + cell.node.clientWidth, 0);
        // const relativeDifferenceOverAllCells = (sum + differenceInPx) / sum;

        const globalRelativeDifference = (widthSum + differenceInPx) / widthSum;

        const relativeSizeSum = cells.reduce((sum, cell) => sum + cell.relativeSize, 0);
        const newRelativeSizeSum = relativeSizeSum * globalRelativeDifference;

        // const scaledDifferenceInPX = differenceInPx * (sum / this.node.clientWidth);

        for (let cell of cells) {
            const cellWidth = cell.node.clientWidth;
            const widthRatio = cellWidth / widthSum;
            // const proportio÷n = (cellWidth / sum;
            // console.log("pro÷÷portion", proportion);

            // const scaledDiff = ((widthSum + differenceInPx) / widthSum) * widthRatio;

            // const newRelativeSize = cell.relativeSize * ((cellWidth + differenceInPx) / cellWidth);
            // const differenceInPxProportionalToRelativeSize = differenceInPx * cell.relativeSize;
            const newRelativeSize = newRelativeSizeSum * widthRatio;

            console.log(`${cell.relativeSize.toFixed(2)} => ${newRelativeSize.toFixed(2)}`);

            cell.resizeToRelativeSize(Math.max(0, Math.min(1, newRelativeSize)));

        }
    }

    private onCellResizeHandleDrag(handle: CellResizeHandle, dx: number): void {
        if (dx === 0) {
            return;
        }

        const leftCell = this.cells.find(cell => cell.cellIndex === handle.leftCellIndex)!;
        const rightCell = this.cells.find(cell => cell.cellIndex === handle.rightCellIndex)!;
        
        // If dx is positive, grow the relative size of all the cell on the left of the dragged handle
        // and shrink the relative size of the cell on the right
        // If dx is negative, do the opposite
        // In case the future size of the cell to shrink is too small, abort and do nothing
        const leftCellWidth = leftCell.node.clientWidth;
        const rightCellWidth = rightCell.node.clientWidth;
        const leftCellSizeChangeRatio = (leftCellWidth + dx) / leftCellWidth;
        const rightCellSizeChangeRatio = (rightCellWidth - dx) / rightCellWidth;

        if (leftCellWidth * leftCellSizeChangeRatio < 25
        ||  rightCellWidth * rightCellSizeChangeRatio < 25) {
            return;
        }

        leftCell.resizeToRelativeSize(leftCell.relativeSize * leftCellSizeChangeRatio);
        rightCell.resizeToRelativeSize(rightCell.relativeSize * rightCellSizeChangeRatio);
    }

    private startHandlingCellResizeHandleDrags(): void {
        for (let cellResizeHandle of this.cellResizeHandles) {
            const leftCell = this.cells.find(cell => cell.cellIndex === cellResizeHandle.leftCellIndex)!;
            const rightCell = this.cells.find(cell => cell.cellIndex === cellResizeHandle.rightCellIndex)!;

            interact(cellResizeHandle.node)
                .draggable({
                    startAxis: "x",
                    lockAxis: "x",

                    listeners: {
                        move: (event: any) => {
                            this.onCellResizeHandleDrag(cellResizeHandle, event.dx);
                        }
                    },
                })
                .on("dragmove", () => {
                    this.callbacks.onCellResize(leftCell, rightCell, false);
                })
                .on("dragend", () => {
                    this.callbacks.onCellResize(leftCell, rightCell, true);
                });
        }
    }

    private stopHandlingCellResizeHandleDrags(): void {
        for (let cellResizeHandle of this.cellResizeHandles) {
            interact(cellResizeHandle.node).unset();
        }
    }

    onAfterVisualisationDisplay(): void {
        this.startHandlingCellResizeHandleDrags();

        for (let cell of this.cells) {
            cell.onAfterVisualisationDisplay();
        }
    }

    onBeforeVisualisationRemoval(): void {
        this.stopHandlingCellResizeHandleDrags();

        for (let cell of this.cells) {
            cell.onBeforeVisualisationRemoval();
        }
    }
}