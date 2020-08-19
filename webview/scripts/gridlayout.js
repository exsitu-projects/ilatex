class InteractiveGridLayout {
    constructor(visualisation) {
        this.visualisation = visualisation;
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