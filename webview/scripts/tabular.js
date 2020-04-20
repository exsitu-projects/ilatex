function selectCellContent(cellLocation) {
    vscode.postMessage({
        type: MessageTypes.SelectText,
        from: cellLocation.start,
        to: cellLocation.end
    });
}

function updateDocumentCellContent(cellLocations, newContent) {
    vscode.postMessage({
        type: MessageTypes.ReplaceText,
        from: cellLocations.start,
        to: cellLocations.end,
        with: newContent,
        reload: true
    });
}

class InteractiveTable {
    constructor(visualisation) {
        this.visualisation = visualisation;

        // Map of row indices to column indices to locations (start and end)
        this.gridIndicesToCellLocations = new Map();

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
            
            // Create an an empty map to save the positions of the current row's cells
            this.gridIndicesToCellLocations.set(rowIndex, new Map());

            // Process each cell of the current row
            const cells = rows[rowIndex].querySelectorAll("td");
            for (let colIndex = 0; colIndex < cells.length; colIndex++) {
                const cell = cells[colIndex];
                rowData[colIndex] = cell.textContent;

                // Associate cell positions in the grid to cell locations in the source document
                this.gridIndicesToCellLocations.get(rowIndex)
                    .set(colIndex, {
                        start: parseLocationFromAttribute(cell.getAttribute("data-loc-start")),
                        end: parseLocationFromAttribute(cell.getAttribute("data-loc-end"))
                    });
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
                const rowIndex = event.rowIndex;
                const colIndex = parseInt(event.colDef.field);
                const location = self.gridIndicesToCellLocations.get(rowIndex).get(colIndex);
    
                selectCellContent(location);
            },
    
            onCellValueChanged(event) {
                const rowIndex = event.rowIndex;
                const colIndex = parseInt(event.colDef.field);
                const location = self.gridIndicesToCellLocations.get(rowIndex).get(colIndex);
    
                updateDocumentCellContent(location, event.newValue);
            },
    
            onGridReady(event) {
                event.api.sizeColumnsToFit();
            }
        });
    }
}

// Setup interactive table objects for tabular visualisations
// function createInteractiveTables() {
//     const tabularVisualisations = visualisationsNode.querySelectorAll(`.visualisation[data-name="tabular"]`);
//     for (let visualisation of tabularVisualisations) {
//         new InteractiveTable(visualisation);
//     }
// }

// visualisationsNode.addEventListener("visualisations-changed", event => {
//     createInteractiveTables();
// });

pdfNode.addEventListener("visualisation-displayed", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "tabular") {
        let i = new InteractiveTable(visualisationNode);
        console.log("Created int table: ", i);
    }
});

pdfNode.addEventListener("visualisation-hidden", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "tabular") {
        // TODO
    }
});