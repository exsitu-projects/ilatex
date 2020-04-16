// Get access to the VSCode API
const vscode = acquireVsCodeApi();

// Current element with focus
let currentlyFocusedElement = null;

// Available types of messages (from/to the extension)
const MessageTypes = {
    FocusVisualisation: "FocusVisualisation",
    ReloadPDF: "ReloadPDF",
    
    SelectText: "SelectText",
    ReplaceText: "ReplaceText"
};

// Handle clicks on selectable elements
// (the extension will select the associated block of code on click)
function parseLocationFromAttribute(attrValue) {
    const [_, line, column] = /(\d+);(\d+)/.exec(attrValue);
    return {
        lineIndex: Number(line) - 1,
        columnIndex: Number(column) - 1
    };
}

const selectableVisualisations = document.querySelectorAll(".visualisation.selectable");
for (let element of selectableVisualisations) {
    element.addEventListener("click", () => {
        const from = parseLocationFromAttribute(element.getAttribute("data-loc-start"));
        const to = parseLocationFromAttribute(element.getAttribute("data-loc-end"));

        vscode.postMessage({
            type: MessageTypes.SelectText,
            from: from,
            to: to
        });
    });
}

// Extension message handlers
function focusVisualisation(id) {
    // Remove the focus from the currently focused element (if any)
    if (currentlyFocusedElement) {
        currentlyFocusedElement.classList.remove("focused");
    }

    // Bring focus to the visualisation with the given id (if any)
    const visualisationElement = document.querySelector(`.visualisation[data-id="${id}"]`);
    if (visualisationElement) {
        currentlyFocusedElement = visualisationElement;
        visualisationElement.classList.add("focused");
    }
}

// Handle extension messages
window.addEventListener("message", message => {
    console.log("Received message:", message);

    const messageType = message.data.type;
    if (! (message && messageType)) {
        console.error("iLatex's webview is unable to handle the following message:", message);
        return;
    }

    switch (messageType) {
        case MessageTypes.FocusVisualisation:
            focusVisualisation(message.data.id);
            break;
        
        default:
            console.error("iLatex's webview does not know message type:", messageType);
    }
});