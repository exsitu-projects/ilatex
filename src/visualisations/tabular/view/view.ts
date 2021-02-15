import "./HandsontableApi";
import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView, VisualisationViewInstantiationContext } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { VisualisationMetadata } from "../../../shared/visualisations/types";


interface HandsontableCellCoords {
    row: number,
    col: number
};


interface ColumnDetail {
    type: string;
}


interface CellLocation {
    rowIndex: number;
    columnIndex: number;
}


class TabularView extends AbstractVisualisationView {
    static readonly visualisationName = "tabular";
    readonly visualisationName = TabularView.visualisationName;

    private columnDetails: ColumnDetail[];
    private tableContent: string[][];

    private viewNode: HTMLElement;
    private handsontableContainerNode: HTMLElement;
    private handsontableInstance: Handsontable | null;
    private handsontableMutationObserver: MutationObserver | null;
    
    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext) {
        super(contentNode, metadata, context);

        this.columnDetails = this.extractColumnDetails();
        this.tableContent = this.extractTableContent();

        this.handsontableContainerNode = document.createElement("div");
        this.handsontableContainerNode = this.createHandsontableContainer();
        this.viewNode = document.createElement("div");
        this.viewNode.append(this.handsontableContainerNode);

        this.handsontableInstance = null;
        this.handsontableMutationObserver = null; 
        this.generateNewHandsontable();
    }

    // Extract column definitions from the table header
    private extractColumnDetails(): ColumnDetail[] {
        const columnDetails = [];

        const header = this.contentNode.querySelector("thead")!;
        const headerCellNodes = Array.from(header.querySelectorAll("th"));
        for (let node of headerCellNodes) {
            columnDetails.push({
                type: node.textContent ?? ""
            });
        }

        return columnDetails;
    }

    // Extract data from the regular table cells
    private extractTableContent(): string[][] {
        const tableContent = [];

        const contentRowNodes = Array.from(this.contentNode.querySelectorAll("tbody > tr"));
        for (let contentRowNode of contentRowNodes) {
            // Create and fill a new row for the table content
            const row: string[] = [];
            tableContent.push(row);

            const contentCellNodes = Array.from(contentRowNode.querySelectorAll("td"));
            for (let contentCellNode of contentCellNodes) {
                row.push(contentCellNode.textContent!);
            }
        }

        return tableContent;
    }

    private createHandsontableContainer(): HTMLElement {
        const containerElement = document.createElement("div");
        containerElement.classList.add("handsontable-container");

        // Initial refining of the table container's height
        // It will be finely adjusted once the table is appended to the DOM
        containerElement.style.setProperty(
            "--table-height",
            `${(this.tableContent.length + 1) * 23}px`
        );

        return containerElement;
    }

    private createHandsontableInstance(): Handsontable {
        return new Handsontable(this.handsontableContainerNode, {
            data: this.tableContent,

            colHeaders: (index: number) => this.columnDetails[index].type,
            rowHeaders: Array(this.tableContent.length).fill(" "),

            stretchH: "all",
            selectionMode: "single",
            manualColumnMove: true,
            manualRowMove: true,
            
            licenseKey: "non-commercial-and-evaluation"
        });
    }

    private startHandlingHandsontableEvents(): void {
        if (!this.handsontableInstance) {
            console.error("Adding handsontables event handlers requires a Handsontable instance.");
            return;
        }

        // Structure holding information about the current drag operation (if any)
        // It is shared for row and column drag operations since only one element an be dragged at a time
        const currentDragDetail: {
            lastMouseDownCoords: HandsontableCellCoords | null,
            lastMouseUpCoords: HandsontableCellCoords | null
        } = {
            lastMouseDownCoords: null,
            lastMouseUpCoords: null
        };

        // Define all the callbacks to add to hooks provided by the current handsontable instance
        // The keys of the record are hook names; the values are the callback functions
        const self = this;
        const handsontableHookCallbacks: Record<string, (...parameters: any) => void> = {
            beforeOnCellMouseDown(event, coords, td) {
                currentDragDetail.lastMouseDownCoords = coords;
            },

            afterRowMove(movedRows, finalIndex, dropIndex, movePossible, orderChanged) {
                if (orderChanged) {
                    self.moveDocumentRow(currentDragDetail.lastMouseDownCoords!.row, finalIndex);
                }
            },

            afterColumnMove(movedColumns, finalIndex, dropIndex, movePossible, orderChanged) {
                if (orderChanged) {
                    self.moveDocumentColumn(currentDragDetail.lastMouseDownCoords!.col, finalIndex);
                }
            },

            afterChange(changes, source) {
                for (let change of changes) {
                    self.setDocumentCellContent({
                        rowIndex: change[0],
                        columnIndex: change[1],
                    }, change[3]);
                }
            },

            afterSelection(row, column, row2, column2) {
                self.selectDocumentCellContent({
                    rowIndex: row,
                    columnIndex: column,
                });
            }
        };

        // For each callback specified in the object defined just above,
        // add it to the related hook in the current handsontable instance
        for (let [eventId, callback] of Object.entries(handsontableHookCallbacks)) {
            Handsontable.hooks.add(eventId, callback, this.handsontableInstance);
        }
    }

    private stopHandlingHandsontableEvents(): void {
        if (!this.handsontableInstance) {
            console.error("Removing handsontables event handlers requires a Handsontable instance.");
            return;
        }

        // Remove all the callbacks which (may) have been added to the current handsontable instance
        Handsontable.hooks.destroy(this.handsontableInstance);
    }

    private selectDocumentCellContent(cellLocation: CellLocation): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "select-cell-content",
            notification: {
                columnIndex: cellLocation.columnIndex,
                rowIndex: cellLocation.rowIndex
            }
        });
    }

    private setDocumentCellContent(cellLocation: CellLocation, newContent: string): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "set-cell-content",
            notification: {
                columnIndex: cellLocation.columnIndex,
                rowIndex: cellLocation.rowIndex,
                newContent: newContent
            }
        });
    }

    private moveDocumentRow(oldRowIndex: number, newRowIndex: number): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "move-row",
            notification: {
                oldRowIndex: oldRowIndex,
                newRowIndex: newRowIndex
            }
        });
    }

    private moveDocumentColumn(oldColumnIndex: number, newColumnIndex: number): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "move-column",
            notification: {
                oldColumnIndex: oldColumnIndex,
                newColumnIndex: newColumnIndex
            }
        });
    }

    private startObservingHandsontableMutations() {
        this.handsontableMutationObserver = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                // Since we only seek to observe style changesm
                // we only want to react to attribute changes 
                if (mutation.type === "attributes") {
                    this.resizeHandsontableContainer();
                }
            }
        });
        
        // The element to observe is a descendant of the Handsontable top-level container
        // cf. the explanation given in resizeHandsontableContainer's method definition
        const targetElement = this.handsontableContainerNode.querySelector(".wtHider")! as HTMLElement;
        this.handsontableMutationObserver.observe(targetElement, { attributes: true });
    }

    private stopObservingHandsontableMutations() {
        if (!this.handsontableMutationObserver) {
            console.error("The Handsontable's mutation observer can only be removed if it exists.");
            return;
        }

        this.handsontableMutationObserver.disconnect();
    }

    // Note: this requires the table to be appended to the DOM
    private resizeHandsontableContainer(): void {
        // Handsontable appears to set the height of the node
        // with the "htHider" class to the total height of the table.
        // This height can therefore be used to resize the container
        // of the current Handsontable instance and update the
        // dimensions of the table (so that it uses it).
        const wtHiderElement = this.handsontableContainerNode.querySelector(".wtHider")! as HTMLElement;
        const totalTableHeight = wtHiderElement.getBoundingClientRect().height;

        this.handsontableContainerNode.style.setProperty(
            "--table-height",
            `${totalTableHeight + 0}px`
        );
        this.handsontableInstance.refreshDimensions();
    }

    private generateNewHandsontable(): void {
        this.handsontableInstance = this.createHandsontableInstance();

        this.startHandlingHandsontableEvents();
        this.startObservingHandsontableMutations();
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;

        // Extract fresh data fron the new content node
        this.columnDetails = this.extractColumnDetails();
        this.tableContent = this.extractTableContent();

        // Create and configure a new container for the future new table
        this.handsontableContainerNode = this.createHandsontableContainer();

        // Remove the old event listeners and mutation observers
        // before creating a new Handsontable instance
        this.stopHandlingHandsontableEvents();
        this.stopObservingHandsontableMutations();

        // Replace the content of the old view node by the new container
        this.viewNode.innerHTML = "";
        this.viewNode.append(this.handsontableContainerNode);

        // Populate the new container with a new table
        this.generateNewHandsontable();
    }
}

export class TabularViewFactory implements VisualisationViewFactory {
    readonly visualisationName = TabularView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext): VisualisationView {
        return new TabularView(contentNode, metadata, context);
    }
}