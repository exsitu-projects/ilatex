class InteractiveTable {
    constructor(visualisation) {
        this.visualisation = visualisation;

        // Column definitions
        this.columns = [];

        // Content of the table
        this.data = [];

        // Updated lists of column and row indices
        // Those are updated when the table is modified,
        // so that the always remain up-to-date
        this.columnFieldsToIndices = new Map();

        this.init();
    }

    init() {
        this.parseTableHeader();
        this.parseTableContent();

        // If the table has no header, create default column definitions
        if (this.columns.length === 0) {
            this.createDefaultColumnDefinitions();
        }

        // Map each column field to its original column index
        this.mapColumnFieldsToIndices();

        // Enable cell editing on all columns
        for (let column of this.columns) {
            column.editable = true;
        }

        // Enable row dragging on the first column
        // this.columns[0].rowDrag = true;

        this.replaceVisualisationHTML();
    }

    // Extract column definitions from the table header (if any)
    parseTableHeader() {
        const header = this.visualisation.querySelector("thead");
    
        if (header) {
            const headerCells = header.querySelectorAll("th");
            for (let i = 0; i < headerCells.length; i++) {
                const columnOption = headerCells[i].textContent;
                const className = columnOption === "l" ? "align-left"
                                : columnOption === "c" ? "align-center"
                                : columnOption === "r" ? "align-right"
                                : "align-left"; // align left by default
    
                // Only columns where cells are paragraphs with a fixed width can be resized
                const columnCanBeResized = ["p", "m", "b"]
                    .includes(columnOption.charAt(0));
    
                // TODO: if the column can be resized, set its initial size
                // according to the specified length parameter (if any)
    
                this.columns.push({
                    headerName: columnOption,
                    field: i.toString(),
                    cellClass: className,
                    resizable: columnCanBeResized,
                    suppressSizeToFit: columnCanBeResized
                });
            }
        }
    }

    // Extract data from the regular table cells
    parseTableContent() {
        const rows = this.visualisation.querySelectorAll("tbody > tr");

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            // Create and add an empty object for row data
            const rowData = {};
            this.data.push(rowData);

            // Process each cell of the current row
            const cells = rows[rowIndex].querySelectorAll("td");
            for (let colIndex = 0; colIndex < cells.length; colIndex++) {
                const cell = cells[colIndex];
                rowData[colIndex] = cell.textContent;
            }
        }
    }
    
    createDefaultColumnDefinitions() {
        const dataRow = this.data[0];
        this.columns = Object.keys(dataRow)
            .map(key => {
                return { headerName: "", field: key };
            });
    }

    mapColumnFieldsToIndices() {
        for (let i = 0; i < this.columns.length; i++) {
            const column = this.columns[i];
            this.columnFieldsToIndices.set(column.field, i);
        }
    }

    selectCellContent(cellLocation) {
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

    reorderColumn(field, oldColumnIndex, newColumnIndex) {
        // Update the actual indices of the column
        const updateIndex = oldColumnIndex > newColumnIndex
                          ? (i => i < oldColumnIndex && i >= newColumnIndex ? i + 1 : i)  // <-- right to left
                          : (i => i <= newColumnIndex && i > oldColumnIndex ? i - 1 : i); // --> left to right
        for (let [field, index] of this.columnFieldsToIndices.entries()) {
            this.columnFieldsToIndices.set(field, updateIndex(index));
        }

        this.columnFieldsToIndices.set(field, newColumnIndex);

        notifyVisualisation(this.visualisation, "reorder-column", {
            oldColumnIndex: oldColumnIndex,
            newColumnIndex: newColumnIndex
        }, true);
    }
    
    // Create a new instance of ag-Grid to replace the content of the visualisation node
    replaceVisualisationHTML() {
        const self = this;

        // Values set while a column is dragged
        // (useful since the actual edit is only performed after the drop)
        const columnDragDetails = {
            hasChanged: false,
            columnField: "",
            oldColumnIndex: 0,
            newColumnIndex: 0
        };

        this.visualisation.innerHTML = "";
        this.visualisation.classList.add("ag-theme-balham");
    
        new agGrid.Grid(this.visualisation, {
            columnDefs: this.columns,
            rowData: this.data,
            //rowDragManaged: true,
    
            onCellClicked(event) {
                self.selectCellContent({
                    rowIndex: event.rowIndex,
                    columnIndex: parseInt(event.colDef.field)
                });
            },
    
            onCellValueChanged(event) {
                self.updateDocumentCellContent({
                    rowIndex: event.rowIndex,
                    columnIndex: parseInt(event.colDef.field)
                }, event.newValue);
            },

            // onDragStarted(event) {
            //     console.log("drag started", event);
            // },

            onColumnMoved(event) {
                console.log("column moved", event);

                const columnField = event.column.colId;
                columnDragDetails.columnField = columnField;
                columnDragDetails.oldColumnIndex = self.columnFieldsToIndices.get(columnField);
                columnDragDetails.newColumnIndex = event.toIndex;
                columnDragDetails.hasChanged = true;
            },

            onDragStopped() {
                if (columnDragDetails.hasChanged) {
                    console.log("move col from ", columnDragDetails.oldColumnIndex, " to ", columnDragDetails.newColumnIndex);

                    self.reorderColumn(
                        columnDragDetails.columnField,
                        columnDragDetails.oldColumnIndex,
                        columnDragDetails.newColumnIndex
                    );
                    columnDragDetails.hasChanged = false;
                }
            },
    
            onGridReady(event) {
                event.api.sizeColumnsToFit();
            }
        });
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