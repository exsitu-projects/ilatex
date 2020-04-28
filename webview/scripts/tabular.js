class InteractiveTable {
    constructor(visualisation) {
        this.visualisation = visualisation;

        // Column definitions
        this.columns = [];

        // Content of the table
        this.data = [];

        this.init();
    }

    init() {
        this.parseTableHeader();
        this.parseTableContent();

        // If the table has no header, create default column definitions
        if (this.columns.length === 0) {
            this.createDefaultColumnDefinitions();
        }

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
    
    // Create a new instance of ag-Grid to replace the content of the visualisation node
    replaceVisualisationHTML() {
        const self = this;

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