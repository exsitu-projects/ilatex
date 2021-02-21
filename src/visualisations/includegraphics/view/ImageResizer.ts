import "./interactjsApi";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { ImageEditor, ImageSize } from "./ImageEditor";
import { IncludegraphicsOptions } from "./view";

export class ImageResizer extends ImageEditor {
    private resizerFrameNode: HTMLElement;
    private resizerNode: HTMLElement;
    private resizerImageNode: HTMLElement | null;

    constructor(
        imageNode: HTMLImageElement,
        containerNode: HTMLElement,
        initialOptions: IncludegraphicsOptions,
        viewContext: VisualisationViewContext,
        changeCallback: (isFinalChange: boolean) => void
    ) {
        super(imageNode, containerNode, initialOptions, viewContext, changeCallback);

        this.resizerFrameNode = this.createResizerFrameNode();
        this.containerNode.append(this.resizerFrameNode);

        this.resizerNode = this.createResizerNode();
        this.resizerFrameNode.append(this.resizerNode);

        this.resizerImageNode = null;
    }

    private get imageNode(): HTMLImageElement | HTMLCanvasElement | null {
        return this.containerNode.querySelector("img, canvas");
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

        this.initInteract();
    }

    destroy(): void {
        // TODO
        this.containerNode.innerHTML = "";
    }

    protected onIncludegraphicsOptionsUpdate(): void {
        this.resizeFromOptions();
    }

    protected onWebviewResize(): void {
        // TODO
    }

    private createResizerNode(): HTMLElement {
        const resizerNode = document.createElement("div");
        resizerNode.classList.add("image-resizer");

        return resizerNode;
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

    private initInteract(): void {
        interact(this.resizerFrameNode)
        .resizable({
            edges: { top: true, left: true, bottom: true, right: true },
            listeners: {
                move: (event: any) => {
                    const currentImageSize = this.imageSize;
                    this.resizeTo({
                        width: this.imageSize.width + event.deltaRect.width,
                        height: this.imageSize.height + event.deltaRect.height,
                    });
                }
            }
        })
        .on("resizemove", () => { this.notifyChange(false); })
        .on("resizeend", () => { this.notifyChange(true); });
    }

    replaceImageWith(newImageNode: HTMLImageElement | HTMLCanvasElement): void {
        const currentImageSize = this.imageSize;
        newImageNode.style.width = `${currentImageSize.width}px`;
        newImageNode.style.height = `${currentImageSize.height}px`;
        newImageNode.classList.add("image");

        if (this.resizerImageNode) {
            this.resizerImageNode.remove();
        }

        this.resizerNode.append(newImageNode);
        this.resizerImageNode = newImageNode;
    }

    private resizeFromOptions(): void {
        const pdfPageScale = this.viewContext.pdfPageDetail?.scale;
        if (!pdfPageScale) {
            console.warn("The size of the image resizer cannot be set: the PDF page scale could not be retrieved.");
            return;
        }

        const imageSize = ImageEditor.extractImageSizeFrom(this.options, this.naturalImageSize, pdfPageScale);
        this.resizeTo(imageSize);
    }

    private resizeTo(newSize: ImageSize): void {
        // console.info("=== Resize ===");
        // console.log(newSize);
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

        // this.updateResizerFramePosition();
    }

    private updateResizerFramePosition(): void {
        const resizerNodeBox = this.resizerNode.getBoundingClientRect();


        // Update the position of the frame
        // this.resizerFrameNode.style.top = `${resizerNodeBox.top - (handleSize / 2)}px`;
        // this.resizerFrameNode.style.left = `${resizerNodeBox.left - (handleSize / 2)}px`;
    }
}