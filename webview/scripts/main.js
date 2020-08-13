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
    
    SaveDocument: "SaveDocument",
    NotifyVisualisation: "NotifyVisualisation"
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

function notifyVisualisation(visualisationNode, subject, payload, reparse) {
    const id = parseInt(visualisationNode.getAttribute("data-id"));
    const sourceIndex = parseInt(visualisationNode.getAttribute("data-source-index"));

    vscode.postMessage({
        type: MessageTypes.NotifyVisualisation,
        id: id,
        sourceIndex: sourceIndex,
        subject: subject,
        payload: payload,
        reparseDocumen: reparse
    });
}

function revealVisualisationCode(visualisationNode) {
    notifyVisualisation(visualisationNode, "reveal-code");
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

function triggerVisualisationsUpdate(html, requestedByVisualisation) {
    // Replace the HTML of the visualisations
    visualisationsNode.innerHTML = html;

    // Emit a synthetic event to signal the update
    // This should be used to process the HTML in other scripts
    visualisationsNode.dispatchEvent(new CustomEvent("visualisations-changed", {
        detail: {
            requestedByVisualisation: requestedByVisualisation
        }
    }));
}

function triggerPDFUpdate(uri) {
    // Emit a synthetic event to signal that the PDF must be updated
    // This should be used to re-load and re-draw the PDF and the annotations
    pdfNode.dispatchEvent(new CustomEvent("pdf-changed", {
        detail: {
            pdfUri: uri
        }
    }));
}

function triggerPDFResize() {
    // Emit a synthetic event to signal that the PDF must be redrawn
    // This should be used to resize the PDF when the webview itself has been resized
    pdfNode.dispatchEvent(new CustomEvent("pdf-resized", {}));    
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
            triggerVisualisationsUpdate(message.data.with, message.data.requestedByVisualisation);
            break;

        case MessageTypes.UpdatePDF:
            triggerPDFUpdate(message.data.uri);
            break;
        
        default:
            console.error("iLatex's webview does not know message type:", messageType);
    }
});

// Handle webview resize
// For performances reasons, we attempt not to resize the PDF
// as long as the webview seems to be resized
const MAX_WEBVIEW_RESIZE_STEP_DURATION = 500; // ms
let timeoutBeforePdfResize = null;

window.addEventListener("resize", event => {
    if (timeoutBeforePdfResize !== null) {
        clearTimeout(timeoutBeforePdfResize);
    }

    timeoutBeforePdfResize = setTimeout(function() {
        triggerPDFResize();
        timeoutBeforePdfResize = null;
    }, MAX_WEBVIEW_RESIZE_STEP_DURATION);
});