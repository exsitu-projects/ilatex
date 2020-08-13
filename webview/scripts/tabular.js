class InteractiveTable {
    constructor(visualisation) {
        this.visualisation = visualisation;

        // Details about the columns
        this.columnDetails = [];

        // Content of the table
        this.data = [];

        // Updated lists of column and row indices
        // Those are updated when the table is modified,
        // so that the always remain up-to-date
        // this.columnFieldsToIndices = new Map();

        this.init();
    }

    init() {
        this.parseTableHeader();
        this.parseTableContent();

        this.replaceVisualisationHTML();
    }

    // Extract column definitions from the table header (if any)
    // This must be performed BEFORE parsing the rest of the data
    parseTableHeader() {
        const header = this.visualisation.querySelector("thead");
    
        if (header) {
            const headerCells = header.querySelectorAll("th");
            for (let i = 0; i < headerCells.length; i++) {
                const columnOption = headerCells[i].textContent;
                // const className = columnOption === "l" ? "align-left"
                //                 : columnOption === "c" ? "align-center"
                //                 : columnOption === "r" ? "align-right"
                //                 : "align-left"; // align left by default
    
                // Only columns where cells are paragraphs with a fixed width can be resized
                const columnCanBeResized = ["p", "m", "b"]
                    .includes(columnOption.charAt(0));
    
                // TODO: if the column can be resized, set its initial size
                // according to the specified length parameter (if any)
    
                // Add information about the header cell to the list of column definitions
                this.columnDetails.push({
                    type: columnOption,
                    isResizable: columnCanBeResized
                });
            }
        }
    }

    // Extract data from the regular table cells
    parseTableContent() {
        const rows = this.visualisation.querySelectorAll("tbody > tr");

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            // Create and add an empty object for row data
            const rowData = [];
            this.data.push(rowData);

            // Process each cell of the current row
            const cells = rows[rowIndex].querySelectorAll("td");
            for (let colIndex = 0; colIndex < cells.length; colIndex++) {
                const cell = cells[colIndex];
                rowData.push(cell.textContent);
            }
        }
    }

    mapColumnFieldsToIndices() {
        for (let i = 0; i < this.columnDetails.length; i++) {
            const column = this.columnDetails[i];
            this.columnFieldsToIndices.set(column.field, i);
        }
    }

    selectDocumentCellContent(cellLocation) {
        notifyVisualisation(this.visualisation, "select-cell-code", {
            rowIndex: cellLocation.rowIndex,
            columnIndex: cellLocation.columnIndex
        });
    }
    
    updateDocumentCellContent(cellLocation, newContent) {
        notifyVisualisation(this.visualisation, "set-cell-content", {
            rowIndex: cellLocation.rowIndex,
            columnIndex: cellLocation.columnIndex,
            newContent: newContent
        }, true);
    }

    reorderDocumentColumns(field, oldColumnIndex, newColumnIndex) {
        // Update the actual indices of the column
        // const updateIndex = oldColumnIndex > newColumnIndex
        //                   ? (i => i < oldColumnIndex && i >= newColumnIndex ? i + 1 : i)  // <-- right to left
        //                   : (i=> i <= newColumnIndex && i > oldColumnIndex ? i - 1 : i); // --> left to right
        // for (let [field, index] of this.columnFieldsToIndices.entries()) {
        //     this.columnFieldsToIndices.set(field, updateIndex(index));
        // }

        // this.columnFieldsToIndices.set(field, newColumnIndex);

        notifyVisualisation(this.visualisation, "reorder-column", {
            oldColumnIndex: oldColumnIndex,
            newColumnIndex: newColumnIndex
        }, true);
    }
    
    // Create a new instance of ag-Grid to replace the content of the visualisation node
    replaceVisualisationHTML() {
        const self = this;

        const dragDetails = {
            lastMouseDownCoords: null,
            lastMouseUpCoords: null
        };

        this.data.splice(5, 1); // TEMPOARY FIX (TODO: fix the issue in the core)
        console.log("this.data", this.data);

        this.visualisation.innerHTML = "";
        this.visualisation.style.height = `${this.data.length * 30}px`;
        this.visualisation.style.width = "100%";
        this.visualisation.style.overflow = "hidden";
        this.visualisation.style.padding = "0";

        const htTable = new Handsontable(this.visualisation, {
            data: this.data,
            colHeaders: (index) => this.columnDetails[index].type,
            rowHeaders: Array(this.data.length).fill(" "),
            stretchH: "all",
            selectionMode: "single",
            manualColumnMove: true,
            manualRowMove: true,
            
            licenseKey: "non-commercial-and-evaluation"
        });

        const htTableEventsCallbacks = {
            beforeOnCellMouseDown(event, coords, td) {
                // console.log("beforeOnCellMouseDown", event, coords, td);
                dragDetails.lastMouseDownCoords = coords;
            },

            afterRowMove(movedRows, finalIndex, dropIndex, movePossible, orderChanged) {
                // console.log("afterRowMove", movedRows, finalIndex, dropIndex, movePossible, orderChanged);
                if (orderChanged) {
                    console.log(`Row moved from index ${dragDetails.lastMouseDownCoords.row} to index ${finalIndex}`);
                    self.reorderDocumentColumns(null, dragDetails.lastMouseDownCoords.row, finalIndex);
                }
            },

            afterColumnMove(movedColumns, finalIndex, dropIndex, movePossible, orderChanged) {
                // console.log("afterColumnMove", movedColumns, finalIndex, dropIndex, movePossible, orderChanged);
                if (orderChanged) {
                    console.log(`Column moved from index ${dragDetails.lastMouseDownCoords.col} to index ${finalIndex}`);
                    self.reorderDocumentColumns(null, dragDetails.lastMouseDownCoords.col, finalIndex);
                }
            },

            afterChange(changes, source) {
                // console.log("afterChange", changes, source);
                for (let change of changes) {
                    self.updateDocumentCellContent({
                        rowIndex: change[0],
                        columnIndex: change[0],
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

        for (let [eventId, callback] of Object.entries(htTableEventsCallbacks)) {
            Handsontable.hooks.add(eventId, callback, htTable);
        }
    }
}

pdfNode.addEventListener("visualisation-displayed", event => {
    const visualisationNode = event.detail.visualisationNode;

    if (visualisationNode.getAttribute("data-name") === "tabular") {
        new InteractiveTable(visualisationNode);
    }
});

pdfNode.addEventListener("visualisation-hidden", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "tabular") {
        // TODO
    }
});