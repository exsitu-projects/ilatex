import { VisualisationView } from "./VisualisationView";

export class VisualisationPopup {
    readonly visualisationView: VisualisationView;
    private onClose: (() => void) | null;

    private initialPositionRelativeToAnnotationMask: "above" | "below" | null;

    private popupNode: HTMLElement;
    private backgroundNode: HTMLElement | null;
    private frameNode: HTMLElement | null;
    private titleBarNode: HTMLElement | null;
    private contentNode: HTMLElement | null;

    private errorContainer: HTMLElement | null;
    private unavailabilityErrorNode: HTMLElement | null;
    private isDisplayingAnError: boolean;

    constructor(view: VisualisationView, onClose?: () => void) {
        this.visualisationView = view;
        this.onClose = onClose ?? null;

        this.initialPositionRelativeToAnnotationMask = null;

        // The popup node is the root container of the popup in the DOM
        this.popupNode = document.createElement("div");
        this.popupNode.classList.add("visualisation-popup");

        this.backgroundNode = null;
        this.frameNode = null;
        this.titleBarNode = null;
        this.contentNode = null;

        this.errorContainer = null;
        this.unavailabilityErrorNode = null;
        this.isDisplayingAnError = false;

        this.init();
    }

    private init(): void {
        this.createBackground();
        this.createFrame();
        this.createTitleBar();
        this.createContent();
        this.createErrors();

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
        this.updateFramePosition();

        this.popupNode.append(this.frameNode);
    }

    updateFramePosition(): void {
        const maskCoordinates = this.visualisationView.context.annotationMaskCoordinates
            ?? this.visualisationView.context.initialAnnotationMaskCoordinates;

        // Reset the CSS attributes that position the frame
        this.frameNode!.style.removeProperty("bottom");
        this.frameNode!.style.removeProperty("top");

        // The first time this method is called, decide to position the frame
        // either above or below the annotation mask of the visualisation
        // (depending on the mask position within the current viewport)
        const maskTop = maskCoordinates[1];
        if (this.initialPositionRelativeToAnnotationMask === null) {
            this.initialPositionRelativeToAnnotationMask =
                maskTop > window.scrollY + (window.innerHeight / 2)
                    ? "above"
                    : "below";
        }

        // Then/the next times, pdate the right CSS attribute depending on whether the popup
        // should be displayed below or above the annotation mask of the visualisation
        if (this.initialPositionRelativeToAnnotationMask === "above") {
            const maskTopToWebpageBottom = document.documentElement.clientHeight - maskTop;
            this.frameNode!.style.bottom = `${maskTopToWebpageBottom + 20}px`;
        }
        else {
            const maskBottom = maskCoordinates[3];
            this.frameNode!.style.top = `${maskBottom + 20}px`;
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

        nameNode.textContent = this.visualisationView.title;

        // Add the location (in the code) to the title
        const locationNode = document.createElement("span");
        locationNode.classList.add("location");
        titleNode.append(locationNode);

        locationNode.innerHTML = this.getVisualisationLocationInSourceCode();

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
        this.titleBarNode!.querySelector(".location")!.innerHTML = this.getVisualisationLocationInSourceCode();
    }

    createContent() {
        this.contentNode = document.createElement("div");
        this.contentNode.classList.add("popup-content");
        this.contentNode.setAttribute("data-visualisation-name", this.visualisationView.name);

        this.frameNode!.append(this.contentNode);

        // Render the view inside the popup content
        this.contentNode.append(this.visualisationView.render());   
    }

    // Must be called in case the visualisation is updated
    updateContent() {
        this.contentNode!.innerHTML = "";
        this.contentNode!.append(this.visualisationView.render());
    }

    createErrors(): void {
        this.errorContainer = document.createElement("div");
        this.frameNode!.append(this.errorContainer);        

        // Error message in case the visualisation becomes unavailable (while its view is displayed)
        this.unavailabilityErrorNode = document.createElement("div");
        this.unavailabilityErrorNode.classList.add("popup-error", "unavailable-visualisation-error");
        this.unavailabilityErrorNode.innerHTML = `
            <span class="error-title">This visualisation is currently not available :(</span>
            <p class="error-message">
                This is often caused by a syntax error or an edit iLaTeX could not understand.
                You can try to:
            </p>
            <ul class="error-suggestions">
                <li><strong>check the syntax</strong> of the code <span class="red-highlight">highlighted in red</span></li>
                <li><strong>recompile the document</strong> if it persists (to refresh all the visualisations)</li>
            </ul>
        `;

        this.errorContainer!.append(this.unavailabilityErrorNode);        
    }

    updateErrors(): void {
        // Display an error if the visualisation is unavailable
        if (!this.visualisationView.isAvailable) {
            this.visualisationView.onBeforeVisualisationErrorDisplay();
            this.popupNode.classList.add("error", "error-unavailable");
            this.visualisationView.onAfterVisualisationErrorDisplay();

            this.isDisplayingAnError = true;
        }
        // Otherwise, hide any displayed error and restore the content of the popup
        else if (this.isDisplayingAnError) {
            this.visualisationView.onBeforeVisualisationErrorRemoval();
            this.popupNode.classList.remove("error", "error-unavailable");
            this.visualisationView.onAfterVisualisationErrorRemoval();

            this.isDisplayingAnError = false;
        }
    }

    getVisualisationLocationInSourceCode() {
        const fileName = this.visualisationView.sourceFileName;
        const range = this.visualisationView.sourceFileCodeRange;

        return range.from.line === range.to.line
             ? `(${fileName} &middot; line ${range.from.line + 1})`
             : `(${fileName} &middot; lines ${range.from.line + 1}&#8198;–&#8198;${range.to.line + 1})`;         
    }

    startHandlingBackgroundClicks() {
        this.backgroundNode!.addEventListener("click", event => {
            if (event.target !== this.backgroundNode) {
                return;
            }
    
            this.close();
        });
    }

    onAfterVisualationContentUpdate(): void {
        this.updateContent();
    }

    onAfterVisualisationMetadataUpdate(): void {
        this.updateTitleBar();
        this.updateErrors();
    }

    onBeforePdfResize(): void {
        this.visualisationView.onBeforePdfResize();
    }

    onAfterPdfResize(): void {
        this.updateFramePosition();
        this.visualisationView.onAfterPdfResize();
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

        this.visualisationView.onBeforeVisualisationRemoval();
        this.popupNode.remove();
        this.visualisationView.onAfterVisualisationRemoval();
    }
}