// Get access to the VSCode API
const vscode = acquireVsCodeApi();

// References to the main nodes
const pdfNode = document.querySelector("#pdf");
const visualisationsNode = document.querySelector("#visualisations");

// Available types of messages (from/to the extension)
const MessageTypes = {
    FocusVisualisation: "FocusVisualisation",
    UpdateVisualisations: "UpdateVisualisations",
    UpdatePDF: "UpdatePDF",
    
    SelectText: "SelectText",
    ReplaceText: "ReplaceText",
    SaveDocument: "SaveDocument"
};

// Helper function to extract a location (in the LaTeX document)
// from an HTML attribute (it is formatted as "<line>;<column>")
function parseLocationFromAttribute(attrValue) {
    const [_, line, column] = /(\d+);(\d+)/.exec(attrValue);
    return {
        lineIndex: Number(line) - 1,
        columnIndex: Number(column) - 1
    };
}

function selectVisualisedCode(visualisationNode) {
    const from = parseLocationFromAttribute(visualisationNode.getAttribute("data-loc-start"));
    const to = parseLocationFromAttribute(visualisationNode.getAttribute("data-loc-end"));

    vscode.postMessage({
        type: MessageTypes.SelectText,
        from: from,
        to: to
    });
}

// Extension message handlers
let currentlyFocusedElement = null;

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

function triggerVisualisationsUpdate(html) {
    // Replace the HTML of the visualisations
    visualisationsNode.innerHTML = html;

    // Emit a synthetic event to signal the update
    // This should be used to process the HTML in other scripts
    const event = new Event("visualisations-changed");
    visualisationsNode.dispatchEvent(event);
}

function triggerPDFUpdate(uri) {
    // Emit a synthetic event to signal that the PDF must be updated
    // This should be used to re-load and re-draw the PDF and the annotations
    const event = new CustomEvent("pdf-changed", {
        detail: {
            pdfUri: uri
        }
    });
    pdfNode.dispatchEvent(event);
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

        case MessageTypes.UpdateVisualisations:
            triggerVisualisationsUpdate(message.data.with);
            break;

        case MessageTypes.UpdatePDF:
            triggerPDFUpdate(message.data.uri);
            break;
        
        default:
            console.error("iLatex's webview does not know message type:", messageType);
    }
});




// Handle clicks on selectable elements
// (the extension will select the associated block of code on click)

// const selectableVisualisations = document.querySelectorAll(".visualisation.selectable");
// for (let element of selectableVisualisations) {
//     element.addEventListener("click", () => {
//         const from = parseLocationFromAttribute(element.getAttribute("data-loc-start"));
//         const to = parseLocationFromAttribute(element.getAttribute("data-loc-end"));

//         vscode.postMessage({
//             type: MessageTypes.SelectText,
//             from: from,
//             to: to
//         });
//     });
// }