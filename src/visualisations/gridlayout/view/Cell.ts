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
    readonly contentNode: HTMLElement;
    private cellDropZoneNode: HTMLElement;
    private actionButtonsContainerNode : HTMLElement;

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

        // Create the node and populate it
        this.node = this.createCellNodeFrom();

        this.contentNode = this.createCellContentNodeFrom(contentCellNode);
        this.node.append(this.contentNode);
        
        this.cellDropZoneNode = this.createCellDropZoneNode();
        this.node.append(this.cellDropZoneNode);
                
        this.actionButtonsContainerNode = this.createActionButtonsContainerNode();
        this.node.append(this.actionButtonsContainerNode);
    }

    get draggableNode(): HTMLElement {
        return this.actionButtonsContainerNode;
    }

    get leftCellDropZoneNode(): HTMLElement {
        return this.cellDropZoneNode.querySelector(".left")! as HTMLElement;
    }

    get rightCellDropZoneNode(): HTMLElement {
        return this.cellDropZoneNode.querySelector(".right")! as HTMLElement;
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

    private createCellContentNodeFrom(contentCellNode: HTMLElement): HTMLElement {
        const contentNode = document.createElement("div");
        contentNode.classList.add("cell-content");
        contentNode.textContent = contentCellNode.textContent!.trim();

        return contentNode;
    }

    private createCellDropZoneNode(): HTMLElement {
        const contentNode = document.createElement("div");
        contentNode.classList.add("cell-drop-zone");
        contentNode.innerHTML = `
            <div class="left"></div>
            <div class="right"></div>
        `;

        return contentNode;        
    }

    private createActionButtonsContainerNode(): HTMLElement {
        const contentNode = document.createElement("div");
        contentNode.classList.add("action-buttons-container");

        // Delete button
        const deleteButtonNode = document.createElement("button");
        deleteButtonNode.setAttribute("type", "button");
        deleteButtonNode.classList.add("delete-cell-button");
        deleteButtonNode.addEventListener("click", event => {
            this.callbacks.onCellDeleteButtonClick(this);
        });

        contentNode.append(deleteButtonNode);

        // Before/after cell insert buttons
        const addCellButtonsContainerNode = document.createElement("div");
        addCellButtonsContainerNode.classList.add("add-cell-buttons-container");

        contentNode.append(addCellButtonsContainerNode);

        const addCellBeforeButtonNode = document.createElement("button");
        addCellBeforeButtonNode.setAttribute("type", "button");
        addCellBeforeButtonNode.classList.add("add-cell-before-button");
        addCellBeforeButtonNode.textContent = "Add cell";
        addCellBeforeButtonNode.addEventListener("click", event => {
            this.callbacks.onCellAddButtonClick(this, "before");
        });

        addCellButtonsContainerNode.append(addCellBeforeButtonNode);

        const addCellAfterButtonNOde = document.createElement("button");
        addCellAfterButtonNOde.setAttribute("type", "button");
        addCellAfterButtonNOde.classList.add("add-cell-after-button");
        addCellAfterButtonNOde.textContent = "Add cell";
        addCellAfterButtonNOde.addEventListener("click", event => {
            this.callbacks.onCellAddButtonClick(this, "after");
        });

        addCellButtonsContainerNode.append(addCellAfterButtonNOde);

        return contentNode;        
    }

    resize(): void {
        const parentNode = this.node.parentElement;
        if (!parentNode) {
            console.warn(`The size of the cell node at indices (row ${this.rowIndex}, cell ${this.cellIndex}) cannot be updated: it has no parent node.`);
            return;
        }

        const cellResizeHandleWidth = 8; // px
        const totalWidthOfAllCellResizeHandlesInRow = (this.nbCellsInRow - 1) * cellResizeHandleWidth;

        this.node.style.width = `calc((100% - ${totalWidthOfAllCellResizeHandlesInRow}px) * ${this.scaledRelativeSize})`;
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