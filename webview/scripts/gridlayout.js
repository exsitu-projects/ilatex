class InteractiveGridLayout {
    constructor(visualisation) {
        this.visualisation = visualisation;

        this.rowNodes = this.visualisation.querySelectorAll(".row");
        this.cellNodes = this.visualisation.querySelectorAll(".cell");

        // Internal values used during cell and row resizing
        this.minDurationBetweenResizes = 50; // ms
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

        this.init();
    }

    init() {
        this.wrapAllCellsContent();
        this.addAllResizeHandles();
        this.setAllInitialDimensions();
        this.startHandlingResizingMouseEvents();
    }

    computeCellMaxSize(cellNode) {
        const rowIndexAsString = cellNode.getAttribute("data-row");
        const cellIndexAsString = cellNode.getAttribute("data-cell");

        return [...this.cellNodes]
            .filter(node => node.getAttribute("data-row") === rowIndexAsString
                         && node.getAttribute("data-cell") !== cellIndexAsString)
            .reduce((relativeFreeSpace, node) => relativeFreeSpace - parseFloat(node.getAttribute("data-relative-size")), 1);
    }

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

        // Handle cell resizing
        handleNode.addEventListener("mousedown", event => {
            this.currentCellResize.node = cellNode;
            this.currentCellResize.initialRelativeSize = parseFloat(cellNode.getAttribute("data-relative-size"));
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
        cellNode.style.width = `${Math.round(initialRelativeSize * 100)}%`;
    }

    setInitialRowHeight(rowNode) {
        const initialHeight = parseFloat(rowNode.getAttribute("data-height")); // px
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

    resizeCell(cellNode, newRelativeSize, isFinalSize) {
        // Resize the node in the webview
        cellNode.style.width = `${Math.round(newRelativeSize * 100)}%`;

        // Edit the size in the document
        const { rowIndex, cellIndex } = this.getCellPositionInGrid(cellNode);
        notifyVisualisation(this.visualisation, "resize-cell", {
            rowIndex: rowIndex,
            cellIndex: cellIndex,
            newRelativeSize: newRelativeSize,
            isFinalSize: isFinalSize
        });

        // Update the timestamp of the last edit
        this.lastResizeTimestamp = Date.now();
    }

    computeNewRelativeCellSizeDuringResize(mouseEvent) {
        const mouseX = mouseEvent.clientX;
        const cellBoundingRect = this.currentCellResize.node.getBoundingClientRect();

        const newAbsoluteSize = mouseX - cellBoundingRect.left;

        if (newAbsoluteSize <= 0) {
            return this.currentCellResize.minRelativeSize;
        }
        else if (newAbsoluteSize >= this.currentCellResize.maxAbsoluteSize) {
            return this.currentCellResize.maxRelativeSize;
        }
        else {
            return (newAbsoluteSize / this.currentCellResize.initialAbsoluteSize) * this.currentCellResize.initialRelativeSize;
        }
    }

    startHandlingResizingMouseEvents() {
        this.visualisation.addEventListener("mousemove", event => {
            if (!this.isResized) {
                return;
            }
            
            // Only trigger a resize if the previous one is old enough
            if (Date.now() > this.lastResizeTimestamp + this.minDurationBetweenResizes) {
                const newSize = this.computeNewRelativeCellSizeDuringResize(event);
                this.resizeCell(this.currentCellResize.node, newSize, false);
            }
        });

        this.visualisation.addEventListener("mouseup", event => {
            if (!this.isResized) {
                return;
            }

            const newSize = this.computeNewRelativeCellSizeDuringResize(event);
            this.resizeCell(this.currentCellResize.node, newSize, true);
            this.isResized = false;
        });

        this.visualisation.addEventListener("mouseleave", event => {
            if (!this.isResized) {
                return;
            }

            const newSize = this.computeNewRelativeCellSizeDuringDrag(event);
            this.resizeCell(this.currentCellResize.node, newSize, true);
            this.isResized = false;
        });
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