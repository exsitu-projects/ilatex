import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView, VisualisationViewInstantiationContext } from "../../../webview/visualisations/VisualisationView";
import { Messenger } from "../../../webview/Messenger";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { TaskThrottler } from "../../../shared/tasks/TaskThrottler";
import { VisualisationMetadata } from "../../../shared/visualisations/types";

const enum ResizeType {
    None = "None",
    Cell = "Cell",
    Row = "Row"
}

type ResizeContext = {
    type: ResizeType.None
} | {
    type: ResizeType.Cell
    node: HTMLElement,
    initialRelativeSize: number;
    initialAbsoluteSize: number;
    minRelativeSize: number;
    maxRelativeSize: number;
    maxAbsoluteSize: number;
    initialMouseX: number;
    initialMouseY: number;
} | {
    type: ResizeType.Row
    node: HTMLElement,
    minSize: number;
    initialSize: number;
    initialMouseX: number;
    initialMouseY: number;
};

class GridLayoutView extends AbstractVisualisationView {
    static readonly visualisationName = "grid layout";
    private static readonly DELAY_BETWEEN_RESIZES = 50; // ms

    readonly visualisationName = GridLayoutView.visualisationName;

    private contentRowNodes: HTMLElement[];
    private contentCellNodes: HTMLElement[];

    private viewNode: HTMLElement;

    private resizeThrottler: TaskThrottler;
    private currentResizeContext: ResizeContext;

    private mouseMoveDuringResizeCallback =
        (event: MouseEvent) => { this.onMouseMoveDuringResize(event); };
    private mouseUpDuringResizeCallback =
        (event: MouseEvent) => { this.onMouseUpDuringResize(event); };

    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext) {
        super(contentNode, metadata, context);

        this.contentRowNodes = Array.from(this.contentNode.querySelectorAll(".row"));
        this.contentCellNodes = Array.from(this.contentNode.querySelectorAll(".cell"));

        this.viewNode = document.createElement("div");

        // Internal values used during cell and row resizing
        this.resizeThrottler = new TaskThrottler(GridLayoutView.DELAY_BETWEEN_RESIZES);
        this.currentResizeContext = {
            type: ResizeType.None
        };

        this.startHandlingResizingMouseEvents();
        this.populateViewNode();
    }

    private get isResized(): boolean {
        return this.currentResizeContext.type !== ResizeType.None;
    }

    private addCellContentTo(cellNode: HTMLElement, contentCellNode: HTMLElement): void {
        const contentNode = document.createElement("div");
        contentNode.classList.add("cell-content");
        contentNode.textContent = contentCellNode.textContent;

        // Select the content in the code editor on click
        contentNode.addEventListener("click", event => {
            this.selectCellContentOf(contentCellNode);
        });

        cellNode.append(contentNode);
    }

    private addCellResizeHandleTo(cellNode: HTMLElement, contentCellNode: HTMLElement): void {
        const handleNode = document.createElement("div");
        handleNode.classList.add("cell-resize-handle");

        // Handle cell resizing
        handleNode.addEventListener("mousedown", event => {
            const initialRelativeSize = parseFloat(contentCellNode.getAttribute("data-relative-size")!);
            const initialAbsoluteSize = cellNode.getBoundingClientRect().width;
            const maxRelativeSize = this.computeCellMaxSize(cellNode);

            this.currentResizeContext = {
                type: ResizeType.Cell,
                node: cellNode,
                initialRelativeSize: initialRelativeSize,
                initialAbsoluteSize: initialAbsoluteSize,
                minRelativeSize: 0.05, // to avoid very small cells (in percents)
                maxRelativeSize: maxRelativeSize,
                maxAbsoluteSize: maxRelativeSize
                               / initialRelativeSize
                               * initialAbsoluteSize,
                initialMouseX: event.clientX,
                initialMouseY: event.clientY
            };
        });

        cellNode.append(handleNode);
    }

    private addRowResizeHandleTo(rowNode: HTMLElement, contentRowNode: HTMLElement): void {
        const handleNode = document.createElement("div");
        handleNode.classList.add("row-resize-handle");

        // Handle row resizing
        handleNode.addEventListener("mousedown", event => {
            this.currentResizeContext = {
                type: ResizeType.Row,
                node: rowNode,
                minSize: 10, // to avoid very small rows (in px)
                initialSize: rowNode.getBoundingClientRect().width,
                initialMouseX: event.clientX,
                initialMouseY: event.clientY
            };
        });
        
        rowNode.append(handleNode);
    }

    private setInitialCellWidth(cellNode: HTMLElement, contentCellNode: HTMLElement) {
        const initialRelativeSize = parseFloat(contentCellNode.getAttribute("data-relative-size")!); // percentage (0–1)
        cellNode.style.width = `${Math.round(initialRelativeSize * 100)}%`;
    }

    private setInitialRowHeight(rowNode: HTMLElement, contentRowNode: HTMLElement) {
        const initialHeight = parseFloat(contentRowNode.getAttribute("data-height")!); // px
        rowNode.style.height = `${Math.round(initialHeight)}px`;

        // TODO: scale the height (based on the size of the annotation/width of the visualisation)
    }

    private createCell(contentCellNode: HTMLElement): HTMLElement {
        const cellNode = document.createElement("div");
        cellNode.classList.add("cell");
        cellNode.setAttribute("data-row", contentCellNode.getAttribute("data-row")!);
        cellNode.setAttribute("data-cell", contentCellNode.getAttribute("data-cell")!);
        cellNode.setAttribute("data-init-relative-size", contentCellNode.getAttribute("data-relative-size")!);

        // Populate the cell
        this.addCellContentTo(cellNode, contentCellNode);
        this.addCellResizeHandleTo(cellNode, contentCellNode);

        // Set the initial size of the cell
        this.setInitialCellWidth(cellNode, contentCellNode);

        return cellNode;
    }

    private createRow(contentRowNode: HTMLElement): HTMLElement {
        const rowNode = document.createElement("div");
        rowNode.classList.add("row");
        rowNode.setAttribute("data-row", contentRowNode.getAttribute("data-row")!);

        // Populate the row
        const cellContainerNode = document.createElement("div");
        cellContainerNode.classList.add("cell-container");

        const contentCellNodes = Array.from(contentRowNode.querySelectorAll(".cell"));
        for (let contentCellNode of contentCellNodes) {
            const cellNode = this.createCell(contentCellNode as HTMLElement);
            cellContainerNode.append(cellNode);
        }

        rowNode.append(cellContainerNode);
        this.addRowResizeHandleTo(rowNode, contentRowNode);

        // Set the initial size of the row
        this.setInitialRowHeight(rowNode, contentRowNode);

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
                relativeFreeSpace - parseFloat(node.getAttribute("data-init-relative-size")!),
            1);
    }

    private getRowPositionInGridFromNode(rowNode: HTMLElement) {
        return {
            rowIndex: parseInt(rowNode.getAttribute("data-row")!)
        };
    }

    private getCellPositionInGridFromNode(cellNode: HTMLElement) {
        return {
            rowIndex: parseInt(cellNode.getAttribute("data-row")!),
            cellIndex: parseInt(cellNode.getAttribute("data-cell")!)
        };
    }

    private selectCellContentOf(cellNode: HTMLElement) {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "select-cell-content",
            notification: this.getCellPositionInGridFromNode(cellNode)
        });
    }

   private resizeCell(cellNode: HTMLElement, newRelativeSize: number, isFinalSize: boolean) {
        // Resize the node in the webview
        cellNode.style.width = `${Math.round(newRelativeSize * 100)}%`;

        // Notify the model to perform the change in the document
        const { rowIndex, cellIndex } = this.getCellPositionInGridFromNode(cellNode);
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "resize-cell",
            notification: {
                rowIndex: rowIndex,
                cellIndex: cellIndex,
                newRelativeSize: newRelativeSize,
                isFinalSize: isFinalSize
            }
        });
    }

    private resizeRow(rowNode: HTMLElement, newHeight: number, isFinalSize: boolean) {
        // Resize the node in the webview
        rowNode.style.height = `${Math.round(newHeight)}px`;

        // Notify the model to perform the change in the document
        const { rowIndex } = this.getRowPositionInGridFromNode(rowNode);
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "resize-row",
            notification: {
                rowIndex: rowIndex,
                newHeight: newHeight,
                isFinalSize: isFinalSize
            }
        });
    }

    private computeNewRelativeCellSizeDuringResize(mouseEvent: MouseEvent): number {
        if (this.currentResizeContext.type !== ResizeType.Cell) {
            console.error(`The relative size of a cell can only be recomputed during cell resizing (not during a resize of type "${this.currentResizeContext.type}").`);
            return 0;
        }

        const mouseX = mouseEvent.clientX;
        const cellBoundingRect = this.currentResizeContext.node.getBoundingClientRect();
        const newAbsoluteSize = mouseX - cellBoundingRect.left;

        if (newAbsoluteSize <= 0) {
            return this.currentResizeContext.minRelativeSize;
        }
        else if (newAbsoluteSize >= this.currentResizeContext.maxAbsoluteSize) {
            return this.currentResizeContext.maxRelativeSize;
        }
        else {
            return (newAbsoluteSize / this.currentResizeContext.initialAbsoluteSize)
                 * this.currentResizeContext.initialRelativeSize;
        }
    }

    private computeNewRowHeightDuringResize(mouseEvent: MouseEvent): number {
        if (this.currentResizeContext.type !== ResizeType.Row) {
            console.error(`The height of a row can only be recomputed during row resizing (not during a resize of type "${this.currentResizeContext.type}").`);
            return 0;
        }

        const mouseY = mouseEvent.clientY;
        const rowBoundingRect = this.currentResizeContext.node.getBoundingClientRect();
        const newAbsoluteHeight = mouseY - rowBoundingRect.top;

        return Math.max(
            this.currentResizeContext.minSize,
            newAbsoluteHeight
        );

        // if (newAbsoluteHeight <= 0) {
        //     return this.currentResizeContext.minSize;
        // }

        // return newAbsoluteHeight
    }

    private updateDimensionsDuringResize(mouseEvent: MouseEvent, isFinalSize: boolean = false): void {
        switch (this.currentResizeContext.type) {
            case ResizeType.Cell:
                const newSize = this.computeNewRelativeCellSizeDuringResize(mouseEvent);
                this.resizeCell(this.currentResizeContext.node, newSize, isFinalSize);
                break;

            case ResizeType.Row:
                const newHeight = this.computeNewRowHeightDuringResize(mouseEvent);
                this.resizeRow(this.currentResizeContext.node, newHeight, isFinalSize);
                break;
        }
    }

    private endResize(): void {
        this.currentResizeContext = { type: ResizeType.None };
    }

    private onMouseMoveDuringResize(event: MouseEvent): void {
        // Only trigger a resize if the previous one is old enough
        if (this.isResized) {
            this.resizeThrottler.add(async () => {
                this.updateDimensionsDuringResize(event);
            });
        }
    }

    private onMouseUpDuringResize(event: MouseEvent): void {
        if (this.isResized) {
            this.updateDimensionsDuringResize(event, true);
            this.endResize();            
        }
    }

    private startHandlingResizingMouseEvents(): void {
        document.addEventListener("mousemove", this.mouseMoveDuringResizeCallback);
        document.addEventListener("mouseup", this.mouseUpDuringResizeCallback);
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;
        this.contentRowNodes = Array.from(this.contentNode.querySelectorAll(".row"));
        this.contentCellNodes = Array.from(this.contentNode.querySelectorAll(".cell"));

        this.viewNode.innerHTML = "";
        this.populateViewNode();
    }
    
}

export class GridLayoutViewFactory implements VisualisationViewFactory {
    readonly visualisationName = GridLayoutView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext): VisualisationView {
        return new GridLayoutView(contentNode, metadata, context);
    }
}