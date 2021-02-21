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
    private cropper: Cropper | null;

    private cropperWrapperNode: HTMLElement;
    private invisibleImageNode: HTMLImageElement;

    private cropperReadyCallback: () => void;

    constructor(
        imageNode: HTMLImageElement,
        containerNode: HTMLElement,
        initialOptions: IncludegraphicsOptions,
        viewContext: VisualisationViewContext,
        cropperReadyCallback: () => void,
        changeCallback: (isFinalChange: boolean) => void,
    ) {
        super(imageNode, containerNode, initialOptions, viewContext, changeCallback);

        this.cropper = null;

        this.cropperWrapperNode = this.createCropperWrapperNode();
        this.containerNode.append(this.cropperWrapperNode);

        this.invisibleImageNode = this.createInvisibleImageNode();
        this.cropperWrapperNode.append(this.invisibleImageNode);

        this.cropperReadyCallback = cropperReadyCallback;
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

    protected onWebviewResize(): void {
        // TODO
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
            this.cropper = new Cropper(this.invisibleImageNode, {
                dragMode: "move",
                viewMode: 3,
                toggleDragModeOnDblclick: false,
                zoomable: false,
                scalable: false,
                rotatable: false,
                guides: false,
                center: false,
                highlight: false,
                background: false,
    
                cropmove: event => { this.onCropboxChange(event); },
                cropend: event => { this.onCropboxChangeEnd(event); },
                ready: event => {
                    this.recropFromOptions();
                    this.cropperReadyCallback();
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

        const containerData = cropper.getContainerData();
        const imageData = cropper.getImageData();
        const horizontalScale = containerData.width / imageData.naturalWidth;
        const verticalScale = containerData.height / imageData.naturalHeight;
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
            width: containerData.width - scaledImageCrop.left - scaledImageCrop.right,
            height: containerData.height - scaledImageCrop.top - scaledImageCrop.bottom,
            left:  0 + scaledImageCrop.left,
            top: 0 + scaledImageCrop.top
        });

        // console.log("new cropbox data", cropper.getCropBoxData());
    }

    private onCropboxChange(event: Cropper.CropMoveEvent): void {
        this.notifyChange(false);
    }

    private onCropboxChangeEnd(event: Cropper.CropEndEvent): void {
        this.notifyChange(true);
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