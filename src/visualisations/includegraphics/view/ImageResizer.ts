import "./interactjsApi";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { ImageEditor, ImageSize } from "./ImageEditor";
import { IncludegraphicsOptions } from "./view";

export class ImageResizer extends ImageEditor {
    private naturalAspectRatio: number;
    private aspectRatio: number;
    private lockAspectRatio: boolean;
    private invertAspectRatioLock: boolean;

    private commandBarNode: HTMLElement;
    private resizerFrameNode: HTMLElement;
    private resizerNode: HTMLElement;
    private resizerImageNode: HTMLElement | null;

    private keyDownCallback = (event: KeyboardEvent) => { this.onKeyDown(event); };
    private keyUpCallback = (event: KeyboardEvent) => { this.onKeyUp(event); };
    
    constructor(
        imageNode: HTMLImageElement,
        containerNode: HTMLElement,
        initialOptions: IncludegraphicsOptions,
        viewContext: VisualisationViewContext,
        changeCallback: (isFinalChange: boolean) => void
    ) {
        super(imageNode, containerNode, initialOptions, viewContext, changeCallback);

        this.naturalAspectRatio = 1;
        this.aspectRatio = 1;
        this.lockAspectRatio = true;
        this.invertAspectRatioLock = false;

        this.commandBarNode = this.createCommandBarNode();
        this.containerNode.append(this.commandBarNode);

        this.resizerFrameNode = this.createResizerFrameNode();
        this.containerNode.append(this.resizerFrameNode);

        this.resizerNode = this.createResizerNode();
        this.resizerFrameNode.append(this.resizerNode);

        this.resizerImageNode = null;

        this.updateCommandBarNode();
    }

    get preserveAspectRatio(): boolean {
        return (this.lockAspectRatio && !this.invertAspectRatioLock)
            || (!this.lockAspectRatio && this.invertAspectRatioLock);
    }

    get imageSize(): ImageSize {
        const resizerNodeBox = this.resizerNode.getBoundingClientRect();
        return {
            width: resizerNodeBox.width,
            height: resizerNodeBox.height
        };
    }

    display(): void {
        this.naturalImageSize = ImageEditor.extractNaturalImageSizeFrom(this.preloadedImageNode);
        this.resizeFromOptions();

        this.startHandlingResizeEvents();
        this.startHandlingKeyboardEvents();
    }

    destroy(): void {
        this.stopHandlingResizeEvents();
        this.stopHandlingKeyboardEvents();

        this.containerNode.innerHTML = "";
    }

    protected onIncludegraphicsOptionsUpdate(): void {
        this.resizeFromOptions();
    }

    protected onWebviewResize(): void {
        // TODO
    }

    private createCommandBarNode(): HTMLElement {
        const commandBarNode = document.createElement("div");
        commandBarNode.classList.add("command-bar");

        // Aspect ratio lock
        const aspectRatioLockWrapperNode = document.createElement("div");
        aspectRatioLockWrapperNode.classList.add("aspect-ratio-lock-wrapper");
        commandBarNode.append(aspectRatioLockWrapperNode);

        const aspectRatioLockNode = document.createElement("div");
        aspectRatioLockNode.classList.add("aspect-ratio-lock");
        aspectRatioLockWrapperNode.append(aspectRatioLockNode);

        const checkboxNode = document.createElement("input");
        checkboxNode.setAttribute("type", "checkbox");
        checkboxNode.setAttribute("id", "aspect-ratio-lock-checkbox");
        checkboxNode.addEventListener("change", () => { this.lockAspectRatio = checkboxNode.checked; });
        aspectRatioLockNode.append(checkboxNode);

        const labelNode = document.createElement("label");
        labelNode.setAttribute("for", "aspect-ratio-lock-checkbox");
        aspectRatioLockNode.append(labelNode);

        // Aspect ratio restore button
        const restoreAspectRatioButtonNode = document.createElement("button");
        restoreAspectRatioButtonNode.classList.add("restore-aspect-ratio-button");
        restoreAspectRatioButtonNode.textContent = "Restore aspect ratio";
        restoreAspectRatioButtonNode.addEventListener("click", () => { this.restoreNaturalAspectRatio(); });
        commandBarNode.append(restoreAspectRatioButtonNode);

        return commandBarNode;
    }

    private updateCommandBarNode(): void {
        const aspectRatioLockCheckboxNode = this.commandBarNode.querySelector("#aspect-ratio-lock-checkbox")! as HTMLInputElement;
        aspectRatioLockCheckboxNode.disabled = this.invertAspectRatioLock;
        aspectRatioLockCheckboxNode.checked = this.preserveAspectRatio;
        
        const aspectRatioLockLabelNode = this.commandBarNode.querySelector(".aspect-ratio-lock label")! as HTMLLabelElement;
        aspectRatioLockLabelNode.innerHTML = this.invertAspectRatioLock
            ? `lock aspect ratio <span class="invert-message">(inverted)</span>`
            : `lock aspect ratio <span class="invert-message">(hold shift to invert)</span>`;
    }

    private createResizerFrameNode(): HTMLElement {
        const resizerFrameNode = document.createElement("div");
        resizerFrameNode.classList.add("image-resizer-frame");

        // Create visual handles
        const handleLocations = [
            "top-left", "top", "top-right",
            "left", "right",
            "bottom-left", "bottom", "bottom-right",
        ];

        for (let location of handleLocations) {
            const handleNode = document.createElement("div");
            handleNode.classList.add("handle", location);
            resizerFrameNode.append(handleNode);
        }

        return resizerFrameNode;
    }

    private createResizerNode(): HTMLElement {
        const resizerNode = document.createElement("div");
        resizerNode.classList.add("image-resizer");

        return resizerNode;
    }

    private adaptImageSize(
        size: ImageSize,
        options?: { adaptWidth?: boolean, force?: boolean }
    ): ImageSize {
        const { adaptWidth, force } = {
            adaptWidth: false,
            force: false,
            ...options
        };

        return this.preserveAspectRatio || force
            ? ImageEditor.adaptImageSizeToMatchAspectRatio(size, this.aspectRatio, adaptWidth)
            : size;
    }

    replaceImageWith(
        newImageNode: HTMLImageElement | HTMLCanvasElement,
        newAspectRatio: number,
        options?: { matchNewAspectRatio?: boolean }
    ): void {
        const { matchNewAspectRatio } = {
            matchNewAspectRatio: true,
            ...options
        };

        // Update aspect ratios
        this.naturalAspectRatio = newAspectRatio;
        if (this.preserveAspectRatio && matchNewAspectRatio) {
            this.aspectRatio = newAspectRatio;
        }

        // Change the content of the image resizer node
        if (this.resizerImageNode) {
            this.resizerImageNode.remove();
        }

        newImageNode.classList.add("image");
        this.resizerNode.append(newImageNode);
        this.resizerImageNode = newImageNode;

        // Resize everything accordingly
        // (the new size could differ from the current size to preserve the new aspect ratio)
        const newAdaptedSize = this.adaptImageSize(this.imageSize);
        this.resizeTo(newAdaptedSize);
    }

    private resizeFromOptions(): void {
        const pdfPageScale = this.viewContext.pdfPageDetail?.scale;
        if (!pdfPageScale) {
            console.warn("The size of the image resizer cannot be set: the PDF page scale could not be retrieved.");
            return;
        }

        const imageSize = ImageEditor.extractImageSizeFrom(this.options, this.naturalImageSize, pdfPageScale);
        this.aspectRatio = imageSize.width / imageSize.height;

        this.resizeTo(imageSize);
    }

    private restoreNaturalAspectRatio(): void {
        this.aspectRatio = this.naturalAspectRatio;
        this.resizeTo(this.adaptImageSize(this.imageSize, { force: true }));

        this.notifyChange(true);
    }

    private resizeTo(newSize: ImageSize): void {
        const handleSize = 5; // px

        // Update the size of the frame
        this.resizerFrameNode.style.width = `${newSize.width + handleSize}px`;
        this.resizerFrameNode.style.height = `${newSize.height + handleSize}px`;

        this.resizerNode.style.width = `${newSize.width}px`;
        this.resizerNode.style.height = `${newSize.height}px`;

        if (this.resizerImageNode) { 
            this.resizerImageNode.style.width = `${newSize.width}px`;
            this.resizerImageNode.style.height = `${newSize.height}px`;           
        }
    }

    private startHandlingResizeEvents(): void {
        interact(this.resizerFrameNode)
            .resizable({
                edges: { top: true, left: true, bottom: true, right: true },

                listeners: {
                    move: (event: any) => {
                        const margin = 5; // px
                        const maxWidth = this.containerNode.clientWidth - (2 * margin);

                        // In case the aspect ratio is locked and the user dgas the top or bottom handle,
                        // the width must be adapted instead of the height (otherwise nothing will happen)
                        const adaptWidthInsteadOfHeight =
                            (event.edges.top || event.edges.bottom) && (!event.edges.left && !event.edges.right);
                        
                        const newImageSize = this.adaptImageSize({
                            width: Math.min(this.imageSize.width + event.deltaRect.width, maxWidth),
                            height: this.imageSize.height + event.deltaRect.height,
                        }, { adaptWidth: adaptWidthInsteadOfHeight });

                        this.resizeTo(newImageSize);
                        this.aspectRatio = newImageSize.width / newImageSize.height;
                    }
                },
            })
            .on("resizemove", () => { this.notifyChange(false); })
            .on("resizeend", () => { this.notifyChange(true); });
    }

    private stopHandlingResizeEvents(): void {
        interact(this.resizerFrameNode).unset();
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (event.key === "Shift") {
            this.invertAspectRatioLock = true;
            this.updateCommandBarNode();
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        if (event.key === "Shift") {
            this.invertAspectRatioLock = false;
            this.updateCommandBarNode();
        }
    }

    private startHandlingKeyboardEvents(): void {
        window.addEventListener("keydown", this.keyDownCallback);
        window.addEventListener("keyup", this.keyUpCallback);
    }

    private stopHandlingKeyboardEvents(): void {
        window.removeEventListener("keydown", this.keyDownCallback);
        window.removeEventListener("keyup", this.keyUpCallback);
    }
}