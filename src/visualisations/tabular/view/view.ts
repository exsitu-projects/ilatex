import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView, VisualisationViewInstantiationContext } from "../../../webview/visualisations/VisualisationView";
import { Messenger } from "../../../webview/Messenger";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";

// Since Rollup + the TypeScript plugin seem to require ES6/ESNext to load modules
// from the node_modules directory (even though it's just for types),
// types are not available for Handsontable
declare var Handsontable: any;
type Handsontable = any;

interface HandsontableCellCoords {
    row: number,
    col: number
};

interface ColumnDetail {
    type: string;
    isResizable: boolean;
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
    private handsontableInstance: Handsontable | null;

    constructor(contentNode: HTMLElement, context: VisualisationViewInstantiationContext) {
        super(contentNode, context);

        this.columnDetails = [];
        this.tableContent = [];

        this.viewNode = document.createElement("div");
        this.handsontableInstance = null;

        this.updateWith(contentNode);
    }

    // Extract column definitions from the table header
    extractColumnDetails(): void {
        const header = this.contentNode.querySelector("thead")!;
        const headerCellNodes = Array.from(header.querySelectorAll("th"));

        for (let headerCellNode of headerCellNodes) {
            // Get the type of the column
            const columnType = headerCellNode.textContent ?? "";

            // Only columns whose cells are paragraphs with a fixed width can be resized
            // TODO: if the column can be resized, get their initial size
            const columnCanBeResized = ["p", "m", "b"]
                .includes(columnType.charAt(0));

            // Save information about the current column
            this.columnDetails.push({
                type: columnType,
                isResizable: columnCanBeResized
            });
        }
    }

    // Extract data from the regular table cells
    extractTableContent(): void {
        const contentRowNodes = Array.from(this.contentNode.querySelectorAll("tbody > tr"));
        for (let contentRowNode of contentRowNodes) {
            // Create and fill a new row for the table content
            const row: string[] = [];
            this.tableContent.push(row);

            const contentCellNodes = Array.from(contentRowNode.querySelectorAll("td"));
            for (let contentCellNode of contentCellNodes) {
                row.push(contentCellNode.textContent!);
            }
        }
    }

    selectDocumentCellContent(cellLocation: CellLocation): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "select-cell-code",
            notification: {
                columnIndex: cellLocation.columnIndex,
                rowIndex: cellLocation.rowIndex
            }
        });
    }

    setDocumentCellContent(cellLocation: CellLocation, newContent: string): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "set-cell-content",
            notification: {
                columnIndex: cellLocation.columnIndex,
                rowIndex: cellLocation.rowIndex,
                newContent: newContent
            }
        });
    }

    moveDocumentRow(oldRowIndex: number, newRowIndex: number): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "move-row",
            notification: {
                oldRowIndex: oldRowIndex,
                newRowIndex: newRowIndex
            }
        });
    }

    moveDocumentColumn(oldColumnIndex: number, newColumnIndex: number): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationId: this.visualisationId,
            title: "move-column",
            notification: {
                oldColumnIndex: oldColumnIndex,
                newColumnIndex: newColumnIndex
            }
        });
    }

    createHandsontableInstance(): Handsontable {
        return new Handsontable(this.viewNode, {
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

    startHandlingHandsontableEvents(): void {
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
                // console.log("beforeOnCellMouseDown", event, coords, td);
                currentDragDetail.lastMouseDownCoords = coords;
            },

            afterRowMove(movedRows, finalIndex, dropIndex, movePossible, orderChanged) {
                // console.log("afterRowMove", movedRows, finalIndex, dropIndex, movePossible, orderChanged);
                if (orderChanged) {
                    // console.log(`Row moved from index ${currentDragDetail.lastMouseDownCoords.row} to index ${finalIndex}`);
                    self.moveDocumentRow(currentDragDetail.lastMouseDownCoords!.row, finalIndex);
                }
            },

            afterColumnMove(movedColumns, finalIndex, dropIndex, movePossible, orderChanged) {
                // console.log("afterColumnMove", movedColumns, finalIndex, dropIndex, movePossible, orderChanged);
                if (orderChanged) {
                    // console.log(`Column moved from index ${currentDragDetail.lastMouseDownCoords.col} to index ${finalIndex}`);
                    self.moveDocumentColumn(currentDragDetail.lastMouseDownCoords!.col, finalIndex);
                }
            },

            afterChange(changes, source) {
                // console.log("afterChange", changes, source);
                for (let change of changes) {
                    self.setDocumentCellContent({
                        rowIndex: change[0],
                        columnIndex: change[1],
                    }, change[3]);
                }
            },

            afterSelection(row, column, row2, column2) {
                // console.log("afterSelection", row, column, row2, column2);
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

    stopHandlingHandsontableEvents(): void {
        if (!this.handsontableInstance) {
            console.error("Removing handsontables event handlers requires a Handsontable instance.");
            return;
        }

        // Remove all the callbacks which (may) have been added to the current handsontable instance
        Handsontable.hooks.destroy(this.handsontableInstance);
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;

        // Create and populate fresh data structures from the new content node
        this.columnDetails = [];
        this.tableContent = [];

        this.extractColumnDetails();
        this.extractTableContent();

        // Create a new empty view node and a new Handonstable instance
        this.viewNode = document.createElement("div");

        // TODO: move this elsewhere/remove this
        this.viewNode.innerHTML = "";
        this.viewNode.style.height = `${this.tableContent.length * 30}px`;
        this.viewNode.style.width = "100%";
        this.viewNode.style.overflow = "hidden";
        this.viewNode.style.padding = "0";

        this.tableContent.splice(5, 1); // TEMPOARY FIX (TODO: fix and remove)

        // Remove old Handsontable event handlers before ditching the old handsontable instance
        // and add new handlers to the newly created instance
        this.stopHandlingHandsontableEvents();
        this.handsontableInstance = this.createHandsontableInstance();
        this.startHandlingHandsontableEvents();
    }
    
}

export class TabularViewFactory implements VisualisationViewFactory {
    readonly visualisationName = TabularView.visualisationName;
    
    createView(contentNode: HTMLElement, context: VisualisationViewInstantiationContext): VisualisationView {
        return new TabularView(contentNode, context);
    }
}