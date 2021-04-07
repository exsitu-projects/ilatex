import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { ImageEditor, ImageSize } from "./ImageEditor";
import { IncludegraphicsOptions } from "./view";

interface ImageCropValues {
    left: number;
    bottom: number;
    right: number;
    top: number;
};

export class ImageCropper extends ImageEditor {
    private isVisible: boolean;
    private cropper: Cropper | null;

    private headerBarNode: HTMLElement;
    private cropperWrapperNode: HTMLElement;
    private invisibleImageNode: HTMLImageElement;

    private cropperReadyCallback: () => void;

    constructor(
        imageNode: HTMLImageElement,
        containerNode: HTMLElement,
        initialOptions: IncludegraphicsOptions,
        viewContext: VisualisationViewContext,
        cropperReadyCallback: () => void,
        changeCallback: (changeType: string, isFinalChange: boolean) => void,
    ) {
        super(imageNode, containerNode, initialOptions, viewContext, changeCallback);

        this.isVisible = false;
        this.cropper = null;

        this.headerBarNode = this.createHeaderBarNode();
        this.containerNode.append(this.headerBarNode);

        this.cropperWrapperNode = this.createCropperWrapperNode();
        this.containerNode.append(this.cropperWrapperNode);

        this.invisibleImageNode = this.createInvisibleImageNode();
        this.cropperWrapperNode.append(this.invisibleImageNode);

        this.cropperReadyCallback = cropperReadyCallback;

        // The cropper starts hidden
        this.toggleVisibility(this.isVisible);
    }

    get imageCropValues(): ImageCropValues {
        const cropper = this.cropper;
        if (!cropper) {
            console.warn("No image crop data can be retrieved: there is no cropper.");
            return {
                top: 0, bottom: 0, left: 0, right: 0
            };
        }

        const cropperData = cropper.getData();
        const imageData = cropper.getImageData();

        return {
            top: cropperData.y,
            bottom: imageData.naturalHeight - (cropperData.y + cropperData.height),
            left: cropperData.x,
            right: imageData.naturalWidth - (cropperData.x + cropperData.width)
        };
    }

    display(): void {
        this.naturalImageSize = ImageEditor.extractNaturalImageSizeFrom(this.preloadedImageNode);
        
        const pdfPageScale = this.viewContext.pdfPageDetail?.scale;
        if (!pdfPageScale) {
            console.warn("The cropper cannot be created: the PDF page scale could not be retrieved.");
            return;
        }

        const imageSize = ImageEditor.extractImageSizeFrom(this.options, this.naturalImageSize, pdfPageScale);
        const imageCrop = ImageCropper.extractImageCropFrom(this.options);

        this.createCropper(imageSize, imageCrop);
    }

    destroy(): void {
        this.destroyCropper();
        this.containerNode.innerHTML = "";
    }

    protected onIncludegraphicsOptionsUpdate(): void {
        this.recropFromOptions();
    }

    private toggleVisibility(force?: boolean): void {
        this.isVisible = force ?? !this.isVisible;
        
        // Update classes (the visibility and the animation are controlled by the CSS)
        this.headerBarNode.classList.toggle("cropper-visible", this.isVisible);
        this.cropperWrapperNode.classList.toggle("cropper-visible", this.isVisible);

        // Enable and resize or disable the cropper (if any)
        if (this.cropper) {
            if (this.isVisible) {
                this.cropper.enable();
                requestAnimationFrame(() => {
                    (this.cropper as any).resize();
                    (this.cropper as any).reset();
                    this.recropFromOptions();
                });
            }
            else {
                this.cropper.disable();
            }
        }

        this.updateHeaderBarNode();
    }

    getCropperImageInCanvasOfSize(canvasSize: ImageSize): HTMLCanvasElement | null {
        const cropper = this.cropper;
        if (!cropper) {
            console.warn("The image cannot be cropped into a canvas: there is no cropper.");
            return null;
        }

        return cropper.getCroppedCanvas({
            width: canvasSize.width,
            height: canvasSize.height
        });
    }

    private createHeaderBarNode(): HTMLElement {
        const headerBarNode = document.createElement("div");
        headerBarNode.classList.add("header-bar");
        headerBarNode.addEventListener("click", event => { this.toggleVisibility(); });

        const headerBarMessageNode = document.createElement("div");
        headerBarMessageNode.classList.add("header-bar-message");
        headerBarNode.append(headerBarMessageNode);

        return headerBarNode;        
    }

    private updateHeaderBarNode(): void {
        const headerBarMessageNode = this.headerBarNode.querySelector(".header-bar-message")!;
        headerBarMessageNode.innerHTML = this.isVisible
            ? `Image cropper <span class="comment">(click here to close)</span>`
            : `Image cropper <span class="comment">(click to open)</span>`;
    }

    private createCropperWrapperNode(): HTMLElement {
        const cropperContainerNode = document.createElement("div");
        cropperContainerNode.classList.add("cropper-wrapper");

        return cropperContainerNode;
    }

    private createInvisibleImageNode(): HTMLImageElement {
        const imageNode = document.createElement("img");
        imageNode.setAttribute("src", this.imageUri);
        imageNode.classList.add("invisible-image");

        return imageNode;
    }

    private createCropper(imageSize: ImageSize, imageCrop: ImageCropValues): void {
        this.invisibleImageNode.decode().then(() => {
            // Ensure the cropper wrapper is visible during the creation of the cropper
            // This seems to fix a bug that make the cropper instance yield a slightly shifted image
            // in the cropper ready callback (called in the ready callback below)
            const isCurrentlyVisible = this.isVisible;
            this.toggleVisibility(true);

            this.cropper = new Cropper(this.invisibleImageNode, {
                dragMode: "move",
                viewMode: 2,
                toggleDragModeOnDblclick: false,
                zoomable: false,
                scalable: false,
                rotatable: false,
                guides: false,
                center: false,
                highlight: false,
                // background: false,
    
                cropmove: event => { this.onCropboxChange(event); },
                cropend: event => { this.onCropboxChangeEnd(event); },
                ready: event => {
                    this.recropFromOptions();
                    this.cropperReadyCallback();

                    // Once the ready callback has been called, the normal visibility can be restored
                    // (see more detailed explanations at the beginning of the method)
                    this.toggleVisibility(isCurrentlyVisible);
                }
            });
        });
    }

    private destroyCropper(): void {
        this.cropper?.destroy();
        this.cropper = null;
    }

    private updateCropboxWith(imageCrop: ImageCropValues): void {
        const cropper = this.cropper;
        if (!cropper) {
            console.warn("The cropbox of the cropper cannot be updated: there is no cropper.");
            return;
        }

        const canvasData = cropper.getCanvasData();
        const imageData = cropper.getImageData();
        const horizontalScale = canvasData.width / imageData.naturalWidth;
        const verticalScale = canvasData.height / imageData.naturalHeight;
        const scaledImageCrop = {
            top: imageCrop.top * verticalScale,
            bottom: imageCrop.bottom * verticalScale,
            left: imageCrop.left * horizontalScale,
            right: imageCrop.right * horizontalScale,
        };

        // console.info("=== Recrop ===");
        // console.log("curr cropbox data", cropper.getCropBoxData());
        // console.log("img data", imageData);
        // console.log("crop", imageCrop);
        // console.log("scaled crop", scaledImageCrop);

        cropper.setCropBoxData({
            width: canvasData.width - scaledImageCrop.left - scaledImageCrop.right,
            height: canvasData.height - scaledImageCrop.top - scaledImageCrop.bottom,
            left: canvasData.left + scaledImageCrop.left,
            top: canvasData.top + scaledImageCrop.top
        });

        // console.log("new cropbox data", cropper.getCropBoxData());
    }

    private onCropboxChange(event: Cropper.CropMoveEvent): void {
        this.notifyChange("recrop-image", false);
    }

    private onCropboxChangeEnd(event: Cropper.CropEndEvent): void {
        this.notifyChange("recrop-image", true);
    }

    private recropFromOptions(): void {
        const pdfPageScale = this.viewContext.pdfPageDetail?.scale;
        if (!pdfPageScale) {
            console.warn("The crobox cannot be updated: the PDF page scale could not be retrieved.");
            return;
        }

        const imageCrop = ImageCropper.extractImageCropFrom(this.options);
        this.updateCropboxWith(imageCrop);
    }

    private static extractImageCropFrom(options: IncludegraphicsOptions): ImageCropValues {
        return options.trim ?? {
            top: 0, bottom: 0, left: 0, right: 0
        };
    }
}