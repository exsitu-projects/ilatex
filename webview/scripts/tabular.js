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

const tabularVisualisations = document.querySelectorAll(`.visualisation[data-name="tabular"]`);
for (let visualisation of tabularVisualisations) {
    // Associate cell positions in the grid to cell locations in the source document
    // Map row indices to column indices to locations (start and end)
    const gridIndicesToCellLocations = new Map();

    // Extract column definitions from the table header (if any)
    let columns = [];
    const header = visualisation.querySelector("thead");
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

            columns.push({
                headerName: columnOption,
                field: i.toString(),
                cellClass: className,
                resizable: columnCanBeResized,
                suppressSizeToFit: columnCanBeResized
            });
        }
    }
    
    // Extract data from the regular table cells
    const data = [];
    const rows = visualisation.querySelectorAll("tbody > tr");
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        // Create and add an empty object for row data
        const rowData = {};
        data.push(rowData);
        
        // Create an an empty map to save the positions of the current row's cells
        gridIndicesToCellLocations.set(rowIndex, new Map());

        // Process each cell of the current row
        const cells = rows[rowIndex].querySelectorAll("td");
        for (let colIndex = 0; colIndex < cells.length; colIndex++) {
            const cell = cells[colIndex];
            rowData[colIndex] = cell.textContent;

            // Save the position of the cell (in the document)
            gridIndicesToCellLocations.get(rowIndex)
                .set(colIndex, {
                    start: parseLocationFromAttribute(cell.getAttribute("data-loc-start")),
                    end: parseLocationFromAttribute(cell.getAttribute("data-loc-end"))
                });
        }
    }

    // If the table has no data nor header, skip this visualisation
    if (columns.length === 0 && data.length === 0) {
        continue;
    }

    // If the table has data but no header, create default column definitions
    if (columns.length === 0) {
        const dataRow = data[0];
        columns = Object.keys(dataRow)
            .map(key => {
                return { headerName: "", field: key };
            });
    }

    // Enable row dragging on the first column
    //columns[0].rowDrag = true;

    // Enable cell editing on all columns
    for (let column of columns) {
        column.editable = true;
    }

    // Create a new instance of ag-Grid
    // to replace the content of the visualisation node
    visualisation.innerHTML = "";
    visualisation.classList.add("ag-theme-balham");
    new agGrid.Grid(visualisation, {
        columnDefs: columns,
        rowData: data,
        //rowDragManaged: true,

        onCellClicked(event) {
            const rowIndex = event.rowIndex;
            const colIndex = parseInt(event.colDef.field);
            const location = gridIndicesToCellLocations.get(rowIndex).get(colIndex);

            selectCellContent(location);
        },

        onCellValueChanged(event) {
            const rowIndex = event.rowIndex;
            const colIndex = parseInt(event.colDef.field);
            const location = gridIndicesToCellLocations.get(rowIndex).get(colIndex);

            updateDocumentCellContent(location, event.newValue);
        },

        onGridReady(event) {
            event.api.sizeColumnsToFit();
        }
    });
}