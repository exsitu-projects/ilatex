import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView, VisualisationViewInstantiationContext } from "../../../webview/visualisations/VisualisationView";
import { Messenger } from "../../../webview/Messenger";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";

class GridLayoutView extends AbstractVisualisationView {
    static readonly visualisationName = "gridlayout";
    private static readonly MIN_DURATION_BETWEEN_RESIZES = 50; // ms

    readonly visualisationName = GridLayoutView.visualisationName;

    private contentRowNodes: HTMLElement[];
    private contentCellNodes: HTMLElement[];

    private viewNode: HTMLElement;

    // Internal values used during cell and row resizing
    private lastResizeTimestamp: number;
    private isResized: boolean;
    private currentCellResize: {
        node: HTMLElement | null,
        initialRelativeSize: number;
        initialAbsoluteSize: number;
        minRelativeSize: number;
        maxRelativeSize: number;
        maxAbsoluteSize: number;
        initialMouseX: number;
        initialMouseY: number;
    };

    constructor(contentNode: HTMLElement, context: VisualisationViewInstantiationContext) {
        super(contentNode, context);

        this.contentRowNodes = Array.from(this.contentNode.querySelectorAll(".row"));
        this.contentCellNodes = Array.from(this.contentNode.querySelectorAll(".cell"));

        this.viewNode = document.createElement("div");

        // Internal values used during cell and row resizing
        this.lastResizeTimestamp = 0;
        this.isResized = false;
        this.currentCellResize = {
            node: null,
            initialRelativeSize: 0,
            initialAbsoluteSize: 0,
            minRelativeSize: 0.05, // to avoid strange bugs
            maxRelativeSize: 0,
            maxAbsoluteSize: 0,
            initialMouseX: 0,
            initialMouseY: 0
        };

        this.populateAndPrepareViewNode();
    }

    private addCellContentTo(cellNode: HTMLElement, contentCellNode: HTMLElement): void {
        const contentNode = document.createElement("div");
        contentNode.classList.add("cell-content");
        contentNode.textContent = contentCellNode.textContent;

        // Select the content in the code editor on click
        contentNode.addEventListener("click", event => {
            this.selectCellContentOf(contentCellNode);
        });

        // Display a basic text editor to edit the content on doubleclick
        contentNode.addEventListener("doubleclick", event => {
            // TODO
        });

        cellNode.append(contentNode);
    }

    private addCellResizeHandleTo(cellNode: HTMLElement, contentCellNode: HTMLElement): void {
        const handleNode = document.createElement("div");
        handleNode.classList.add("cell-resize-handle");
        cellNode.setAttribute("data-height", contentCellNode.getAttribute("data-height")!);

        // Handle cell resizing
        handleNode.addEventListener("mousedown", event => {
            this.currentCellResize.node = cellNode;
            this.currentCellResize.initialRelativeSize = parseFloat(contentCellNode.getAttribute("data-relative-size")!);
            this.currentCellResize.initialAbsoluteSize = cellNode.getBoundingClientRect().width;
            this.currentCellResize.maxRelativeSize = this.computeCellMaxSize(cellNode);
            this.currentCellResize.maxAbsoluteSize = this.currentCellResize.maxRelativeSize
                                                   / this.currentCellResize.initialRelativeSize
                                                   * this.currentCellResize.initialAbsoluteSize;
            this.currentCellResize.initialMouseX = event.clientX;
            this.currentCellResize.initialMouseY = event.clientY;

            this.isResized = true;
        });

        cellNode.append(handleNode);
    }

    private addRowResizeHandleTo(rowNode: HTMLElement, contentRowNode: HTMLElement): void {
        const handleNode = document.createElement("div");
        handleNode.classList.add("row-resize-handle");

        // TODO: actually implement the callback required to resize the row
        
        rowNode.after(handleNode);
    }

    private setInitialCellWidth(cellNode: HTMLElement) {
        const initialRelativeSize = parseFloat(cellNode.getAttribute("data-relative-size")!); // percentage (0–1)
        cellNode.style.width = `${Math.round(initialRelativeSize * 100)}%`;
    }

    private setInitialRowHeight(rowNode: HTMLElement) {
        const initialHeight = parseFloat(rowNode.getAttribute("data-height")!); // px
        rowNode.style.height = `${Math.round(initialHeight)}px`;
    }

    private createCell(contentCellNode: HTMLElement): HTMLElement {
        const cellNode = document.createElement("div");
        cellNode.classList.add("cell");
        cellNode.setAttribute("data-row", contentCellNode.getAttribute("data-row")!);
        cellNode.setAttribute("data-cell", contentCellNode.getAttribute("data-cell")!);
        cellNode.setAttribute("data-relative-size", contentCellNode.getAttribute("data-relative-size")!);

        // Populate the cell
        this.addCellContentTo(cellNode, contentCellNode);
        this.addCellResizeHandleTo(cellNode, contentCellNode);

        // Set the initial size of the cell
        this.setInitialCellWidth(cellNode);

        return cellNode;
    }

    private createRow(contentRowNode: HTMLElement): HTMLElement {
        const rowNode = document.createElement("div");
        rowNode.classList.add("row");

        // Populate the row
        const contentCellNodes = Array.from(contentRowNode.querySelectorAll(".cell"));
        for (let contentCellNode of contentCellNodes) {
            const cellNode = this.createCell(contentCellNode as HTMLElement);
            rowNode.append(cellNode);
        }
        this.addRowResizeHandleTo(rowNode, contentRowNode);

        // Set the initial size of the row
        this.setInitialRowHeight(rowNode);

        return rowNode;        
    }

    private populateViewNode(): void {
        for (let contentRowNodes of  this.contentRowNodes) {
            const rowNode = this.createRow(contentRowNodes as HTMLElement);
            this.viewNode.append(rowNode);
        }
    }

    private computeCellMaxSize(cellNode: HTMLElement) {
        const rowIndexAsString = cellNode.getAttribute("data-row");
        const cellIndexAsString = cellNode.getAttribute("data-cell");

        return Array.from(this.contentCellNodes)
            .filter(node => node.getAttribute("data-row") === rowIndexAsString
                         && node.getAttribute("data-cell") !== cellIndexAsString)
            .reduce((relativeFreeSpace, node) =>
                relativeFreeSpace - parseFloat(node.getAttribute("data-relative-size")!),
            1);
    }

    private getCellPositionInGrid(cellNode: HTMLElement) {
        return {
            rowIndex: parseInt(cellNode.getAttribute("data-row")!),
            cellIndex: parseInt(cellNode.getAttribute("data-cell")!)
        };
    }

    private selectCellContentOf(cellNode: HTMLElement) {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "select-cell-content",
            notification: this.getCellPositionInGrid(cellNode)
        });
    }

   private resizeCell(cellNode: HTMLElement, newRelativeSize: number, isFinalSize: boolean) {
        // Resize the node in the webview
        cellNode.style.width = `${Math.round(newRelativeSize * 100)}%`;

        // Notify the model to perform the change in the document
        const { rowIndex, cellIndex } = this.getCellPositionInGrid(cellNode);
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "resize-cell",
            notification: {
                rowIndex: rowIndex,
                cellIndex: cellIndex,
                newRelativeSize: newRelativeSize,
                isFinalSize: isFinalSize
            }
        });

        // Update the timestamp of the last edit
        this.lastResizeTimestamp = Date.now();
    }

    private computeNewRelativeCellSizeDuringResize(mouseEvent: MouseEvent) {
        const mouseX = mouseEvent.clientX;
        const cellBoundingRect = this.currentCellResize.node!.getBoundingClientRect();
        const newAbsoluteSize = mouseX - cellBoundingRect.left;

        if (newAbsoluteSize <= 0) {
            return this.currentCellResize.minRelativeSize;
        }
        else if (newAbsoluteSize >= this.currentCellResize.maxAbsoluteSize) {
            return this.currentCellResize.maxRelativeSize;
        }
        else {
            return (newAbsoluteSize / this.currentCellResize.initialAbsoluteSize)
                 * this.currentCellResize.initialRelativeSize;
        }
    }

    private startHandlingResizingMouseEvents() {
        this.viewNode.addEventListener("mousemove", event => {
            if (!this.isResized) {
                return;
            }
            
            // Only trigger a resize if the previous one is old enough
            if (Date.now() > this.lastResizeTimestamp + GridLayoutView.MIN_DURATION_BETWEEN_RESIZES) {
                const newSize = this.computeNewRelativeCellSizeDuringResize(event);
                this.resizeCell(this.currentCellResize.node!, newSize, false);
            }
        });

        this.viewNode.addEventListener("mouseup", event => {
            if (!this.isResized) {
                return;
            }

            const newSize = this.computeNewRelativeCellSizeDuringResize(event);
            this.resizeCell(this.currentCellResize.node!, newSize, true);
            this.isResized = false;
        });

        this.viewNode.addEventListener("mouseleave", event => {
            if (!this.isResized) {
                return;
            }

            const newSize = this.computeNewRelativeCellSizeDuringResize(event);
            this.resizeCell(this.currentCellResize.node!, newSize, true);
            this.isResized = false;
        });
    }

    private populateAndPrepareViewNode(): void {
        this.populateViewNode();
        this.startHandlingResizingMouseEvents();
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateWith(newContentNode: HTMLElement): void {
        super.updateWith(newContentNode);

        this.contentNode = newContentNode;
        this.contentRowNodes = Array.from(this.contentNode.querySelectorAll(".row"));
        this.contentCellNodes = Array.from(this.contentNode.querySelectorAll(".cell"));

        this.viewNode.innerHTML = "";
        this.populateAndPrepareViewNode();
    }
    
}

export class GridLayoutViewFactory implements VisualisationViewFactory {
    readonly visualisationName = GridLayoutView.visualisationName;
    
    createView(contentNode: HTMLElement, context: VisualisationViewInstantiationContext): VisualisationView {
        return new GridLayoutView(contentNode, context);
    }
}