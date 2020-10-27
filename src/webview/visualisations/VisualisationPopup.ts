import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";
import { VisualisationView } from "./VisualisationView";

export class VisualisationPopup {
    private visualisationView: VisualisationView;
    private maskCoordinates: AnnotationMaskCoordinates;

    private onClose: (() => void) | null;

    private popupNode: HTMLElement;
    private backgroundNode: HTMLElement | null;
    private frameNode: HTMLElement | null;
    private titleBarNode: HTMLElement | null;
    private contentNode: HTMLElement | null;

    constructor(view: VisualisationView, maskCoordinates: AnnotationMaskCoordinates, onClose?: () => void) {
        this.visualisationView = view;
        this.maskCoordinates = maskCoordinates;

        this.onClose = onClose ?? null;

        // The popup node is the root container of the popup in the DOM
        this.popupNode = document.createElement("div");
        this.popupNode.classList.add("visualisation-popup");

        this.backgroundNode = null;
        this.frameNode = null;
        this.titleBarNode = null;
        this.contentNode = null;

        this.init();
    }

    private init(): void {
        this.createBackground();
        this.createFrame();
        this.createTitleBar();
        this.createContent();

        this.startHandlingBackgroundClicks();

        this.open();
    }

    createBackground() {
        this.backgroundNode = document.createElement("div");
        this.backgroundNode.classList.add("popup-background");

        this.popupNode.append(this.backgroundNode);
    }

    createFrame() {
        this.frameNode = document.createElement("div");
        this.frameNode.classList.add("popup-frame");

        this.popupNode.append(this.frameNode);
        
        // Position the frame at the given vertical offset
        const maskTop = this.maskCoordinates[1];
        if (maskTop > window.scrollY + (window.innerHeight / 2)) {
            const maskTopToWebpageBottom = document.documentElement.clientHeight - maskTop;
            this.frameNode.style.bottom = `${maskTopToWebpageBottom + 20}px`;
        }
        else {
            const maskBottom = this.maskCoordinates[3];
            this.frameNode.style.top = `${maskBottom + 20}px`;
        }
    }

    createTitleBar() {
        // Create an empty title bar
        this.titleBarNode = document.createElement("div");
        this.titleBarNode.classList.add("popup-title-bar");
        this.frameNode!.append(this.titleBarNode);

        // Add the name and the location of the visualisation as a title
        const titleNode = document.createElement("span");
        titleNode.classList.add("title");
        this.titleBarNode.append(titleNode);
        
        // Add the name (of the visualised command/environement) to the title
        const nameNode = document.createElement("span");
        nameNode.classList.add("name");
        titleNode.append(nameNode);

        nameNode.textContent = this.visualisationView.contentTitle;

        // Add the location (in the code) to the title
        const locationNode = document.createElement("span");
        locationNode.classList.add("location");
        titleNode.append(locationNode);

        locationNode.innerHTML = this.getVisualisationSourceCodeRangeAsText();

        // Reveal the code of the visualisation when the title is clicked
        titleNode.addEventListener("click", event => {
            this.visualisationView.revealInSourceDocument();
        });

        // Add a button to close the popup
        const closeButtonNode = document.createElement("button");
        closeButtonNode.classList.add("close-button");
        this.titleBarNode.append(closeButtonNode);

        // Close the popup and save the document on click
        closeButtonNode.addEventListener("click", event => {
            this.close();
        });
    }

    // Must be called in case the visualisation is updated
    updateTitleBar() {
        this.titleBarNode!.querySelector(".location")!.innerHTML = this.getVisualisationSourceCodeRangeAsText();
    }

    createContent() {
        this.contentNode = document.createElement("div");
        this.contentNode.classList.add("popup-content");
        this.contentNode.setAttribute("data-visualisation-name", this.visualisationView.visualisationName);

        this.frameNode!.append(this.contentNode);

        // Render the view inside the popup content
        this.contentNode.append(this.visualisationView.render());   
    }

    // Must be called in case the visualisation is updated
    updateContent() {
        this.contentNode!.innerHTML = "";
        this.contentNode!.append(this.visualisationView.render());
    }

    getVisualisationSourceCodeRangeAsText() {
        const location = this.visualisationView.sourceCodeRange;
        return location.start.line === location.end.line
             ? `(line ${location.start.line + 1})`
             : `(lines ${location.start.line + 1}&#8198;–&#8198;${location.end.line + 1})`;         
    }

    startHandlingBackgroundClicks() {
        this.backgroundNode!.addEventListener("click", event => {
            if (event.target !== this.backgroundNode) {
                return;
            }
    
            this.close();
        });
    }

    onAfterDisplayedVisualationContentUpdate() {
        // Update the content and other parts of the popup which may depend on the view
        this.updateTitleBar();
        this.updateContent();
    }

    open() {
        this.visualisationView.onBeforeVisualisationDisplay();
        document.body.prepend(this.popupNode);
        this.visualisationView.onAfterVisualisationDisplay();
    }

    close() {
        if (this.onClose) {
            this.onClose();
        }

        this.visualisationView.onBeforeVisualisationDisappearance();
        this.popupNode.remove();
        this.visualisationView.onAfterVisualisationDisappearance();
    }
}