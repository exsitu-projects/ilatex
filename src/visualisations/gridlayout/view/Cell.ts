import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { GridCallbacks } from "./Grid";

export class CellResizeHandle {
    readonly node: HTMLElement;

    readonly leftCellIndex: number;
    readonly rightCellIndex: number;

    constructor(leftCellIndex: number) {
        this.leftCellIndex = leftCellIndex;
        this.rightCellIndex = leftCellIndex + 1;

        this.node = this.createCellResizeHandleNodeFrom();
    }

    private createCellResizeHandleNodeFrom(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("cell-resize-handle");
        node.setAttribute("data-left-cell-index", this.leftCellIndex.toString());
        node.setAttribute("data-right-cell-index", this.rightCellIndex.toString());

        return node;
    }
}

export class Cell {
    private viewContext: VisualisationViewContext;
    readonly node: HTMLElement;

    readonly cellIndex: number;
    readonly rowIndex: number;

    private initialRelativeSize: number;
    private currentRelativeSize: number;
    private nbCellsInRow: number;
    relativeSizeScale: number;

    private callbacks: GridCallbacks;

    constructor(
        contentCellNode: HTMLElement,
        nbCellsInRow: number,
        viewContext: VisualisationViewContext,
        callbacks: GridCallbacks
    ) {
        this.viewContext = viewContext;

        this.cellIndex = parseInt(contentCellNode.getAttribute("data-cell-index")!);
        this.rowIndex = parseInt(contentCellNode.getAttribute("data-row-index")!);
        this.relativeSizeScale = 1;

        this.initialRelativeSize = parseFloat(contentCellNode.getAttribute("data-relative-size")!);
        this.currentRelativeSize = this.initialRelativeSize;
        this.nbCellsInRow = nbCellsInRow;
        
        this.callbacks = callbacks;

        // Create the node and populate the cell
        this.node = this.createCellNodeFrom();
        this.populateWithContentFrom(contentCellNode);
    }

    get relativeSize(): number {
        return this.currentRelativeSize;
    }

    get scaledRelativeSize(): number {
        return this.currentRelativeSize * this.relativeSizeScale;
    }

    private createCellNodeFrom(): HTMLElement {
        const node = document.createElement("div");
        node.classList.add("cell");
        node.setAttribute("data-cell-index", this.cellIndex.toString());
        node.setAttribute("data-row-index", this.rowIndex.toString());
        // node.setAttribute("data-init-relative-size", contentCellNode.getAttribute("data-relative-size")!);

        return node;
    }

    private populateWithContentFrom(contentCellNode: HTMLElement): void {
        const contentNode = document.createElement("div");
        contentNode.classList.add("cell-content");
        contentNode.textContent = contentCellNode.textContent!.trim();

        // Select the content in the code editor on click
        contentNode.addEventListener("click", event => { this.callbacks.onCellContentClick(this); });

        this.node.append(contentNode);
    }

    // This method assumes the distribution of relative size is valid,
    // i.e. the sum over all the cells of the row is equal to 1
    resize(): void {
        const parentNode = this.node.parentElement;
        if (!parentNode) {
            console.warn(`The size of the cell node at indices (row ${this.rowIndex}, cell ${this.cellIndex}) cannot be updated: it has no parent node.`);
            return;
        }

        const parentNodeBox = parentNode.getBoundingClientRect();
        const cellResizeHandleWidth = 8; // px
        const totalWidthOfAllCellResizeHandlesInRow = (this.nbCellsInRow - 1) * cellResizeHandleWidth;

        // this.node.style.width = `${newAbsoluteSize}px`;
        this.node.style.width = `calc((100% - ${totalWidthOfAllCellResizeHandlesInRow}px) * ${this.currentRelativeSize})`;
    }

    resizeToRelativeSize(newRelativeSize: number): void {
        this.currentRelativeSize = newRelativeSize;
        this.resize();
    }

    onAfterVisualisationDisplay(): void {
        // TODO
    }

    onBeforeVisualisationRemoval(): void {
        // TODO
    }
}