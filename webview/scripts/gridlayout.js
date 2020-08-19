class InteractiveGridLayout {
    constructor(visualisation) {
        this.visualisation = visualisation;

        this.rowNodes = this.visualisation.querySelectorAll(".row");
        this.cellNodes = this.visualisation.querySelectorAll(".cell");

        this.init();
    }

    init() {
        this.wrapAllCellsContent();
        this.addAllResizeHandles();
        // this.wrapAllCells();
        this.setAllInitialDimensions();
    }

    // wrapCell(cellNode) {
    //     const cellWrapperNode = document.createElement("div");
    //     cellWrapperNode.classList.add("cell-wrapper");

    //     cellWrapperNode.append(...cellNode.children);
    //     cellNode.append(cellWrapperNode);
    // }

    // wrapAllCells() {
    //     for (let cellNode of this.cellNodes) {
    //         this.wrapCell(cellNode);
    //     }
    // }

    wrapCellContentOf(cellNode) {
        const contentNode = document.createElement("div");
        contentNode.classList.add("cell-content");

        // Enclose the textual content of the cell within the content node
        contentNode.textContent = cellNode.textContent;

        cellNode.textContent = "";
        cellNode.append(contentNode);
        
        // Select the content in the code editor on click
        contentNode.addEventListener("click", event => {
            this.selectCellContentOf(cellNode);
        });

        // Display a basic text editor to edit the content on doubleclick
        contentNode.addEventListener("doubleclick", event => {
            console.log("TODO: display an editor for the cell content");
            // TODO
        });
    }

    wrapAllCellsContent() {
        for (let cellNode of this.cellNodes) {
            this.wrapCellContentOf(cellNode);
        }
    }

    addCellResizeHandleTo(cellNode) {
        const handleNode = document.createElement("div");
        handleNode.classList.add("cell-resize-handle");

        cellNode.append(handleNode);
    }

    addRowResizeHandleTo(rowNode) {
        const handleNode = document.createElement("div");
        handleNode.classList.add("row-resize-handle");
        
        rowNode.after(handleNode);
    }

    addAllResizeHandles() {
        // Add resize handles to cells
        for (let cellNode of this.cellNodes) {
            this.addCellResizeHandleTo(cellNode);
        }

        // Add resize handles to rows
        for (let rowNode of this.rowNodes) {
            this.addRowResizeHandleTo(rowNode);
        }
    }

    setInitialCellWidth(cellNode) {
        const initialRelativeSize = parseFloat(cellNode.getAttribute("data-relative-size")); // percentage (0–1)
        console.log("initialRelativeSize", initialRelativeSize);
        cellNode.style.width = `${Math.round(initialRelativeSize * 100)}%`;
    }

    setInitialRowHeight(rowNode) {
        const initialHeight = parseFloat(rowNode.getAttribute("data-height")); // px
        console.log("initialHeight", initialHeight);
        rowNode.style.height = `${Math.round(initialHeight)}px`;
    }

    setAllInitialDimensions() {
        // Set the initial dimensions of the every cell
        for (let cellNode of this.cellNodes) {
            this.setInitialCellWidth(cellNode);
        }

        // Set the initial dimensions of the every row
        for (let rowNode of this.rowNodes) {
            this.setInitialRowHeight(rowNode);
        }
    }

    getCellPositionInGrid(cellNode) {
        return {
            rowIndex: parseInt(cellNode.getAttribute("data-row")),
            cellIndex: parseInt(cellNode.getAttribute("data-cell"))
        };
    }

    selectCellContentAt(rowIndex, cellIndex) {
        notifyVisualisation(this.visualisation, "select-cell-content", {
            rowIndex: rowIndex,
            cellIndex: cellIndex
        });
    }

    selectCellContentOf(cellNode) {
        const {rowIndex, cellIndex} = this.getCellPositionInGrid(cellNode);
        this.selectCellContentAt(rowIndex, cellIndex);
    }
}

pdfNode.addEventListener("visualisation-displayed", event => {
    const visualisationNode = event.detail.visualisationNode;

    if (visualisationNode.getAttribute("data-name") === "gridlayout") {
        new InteractiveGridLayout(visualisationNode);
    }
});

pdfNode.addEventListener("visualisation-updated", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "gridlayout") {
        new InteractiveGridLayout(visualisationNode);
    }
});

pdfNode.addEventListener("visualisation-hidden", event => {
    const visualisationNode = event.detail.visualisationNode;
    
    if (visualisationNode.getAttribute("data-name") === "gridlayout") {
        // TODO
    }
});