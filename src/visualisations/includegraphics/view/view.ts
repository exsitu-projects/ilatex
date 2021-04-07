import "../../../webview/static-library-apis/CropperjsApi";
import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { VisualisationMetadata } from "../../../shared/visualisations/types";
import { TaskThrottler } from "../../../shared/tasks/TaskThrottler";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { ImageCropper } from "./ImageCropper";
import { ImageResizer } from "./ImageResizer";

export interface IncludegraphicsOptions {
    width?: number;
    height?: number;
    scale?: number;
    trim?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }
    clip?: boolean;
}

class IncludegraphicsView extends AbstractVisualisationView {
    private static readonly DELAY_BETWEEN_NON_FINAL_OPTIONS_UPDATES = 50; // ms
    static readonly visualisationName = "includegraphics";
    readonly visualisationName = IncludegraphicsView.visualisationName;

    private viewNode: HTMLElement;
    private preloadedImageNode: HTMLImageElement;
    private resizerContainerNode: HTMLElement;
    private cropperContainerNode: HTMLElement;
    
    private resizer: ImageResizer;
    private cropper: ImageCropper;

    private nonFinalOptionsUpdateThrottler: TaskThrottler;


    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext) {
        super(contentNode, metadata, context);

        this.viewNode = document.createElement("div");

        this.preloadedImageNode = document.createElement("img");
        this.preloadedImageNode.classList.add("preloaded-image");
        this.preloadedImageNode.src = this.imageUri;
        this.viewNode.append(this.preloadedImageNode);

        this.preloadedImageNode.decode(); // Start loading/decoding the image as early as possible

        this.resizerContainerNode = document.createElement("div");
        this.resizerContainerNode.classList.add("image-resizer-container");
        this.viewNode.append(this.resizerContainerNode);

        this.cropperContainerNode = document.createElement("div");
        this.cropperContainerNode.classList.add("image-cropper-container");
        this.viewNode.append(this.cropperContainerNode);

        this.resizer = this.createResizer();
        this.cropper = this.createCropper();

        this.nonFinalOptionsUpdateThrottler = new TaskThrottler(IncludegraphicsView.DELAY_BETWEEN_NON_FINAL_OPTIONS_UPDATES);
    }
    
    private get imageNode(): HTMLImageElement {
        return IncludegraphicsView.extractImageFrom(this.contentNode);
    }

    private get imageUri(): string {
        return this.imageNode.src;
    }

    private get options(): IncludegraphicsOptions {
        return IncludegraphicsView.extractOptionsFrom(this.contentNode);
    }

    private createResizer(): ImageResizer {
        return new ImageResizer(
            this.preloadedImageNode,
            this.resizerContainerNode,
            this.options,
            this.context,
            (changeType, isFinalChange) => this.processResizerChange(changeType, isFinalChange)
        );
    }

    private createCropper(): ImageCropper {
        return new ImageCropper(
            this.preloadedImageNode,
            this.cropperContainerNode,
            this.options,
            this.context,
            () => { this.updateResizerImage(false); },
            (changeType, isFinalChange) => this.processCropperChange(changeType, isFinalChange)
        );
    }

    private updateResizerImage(matchNewAspectRatio: boolean = true): void {
        // Display the (possibly cropped) image given by the cropper in the resizer
        const croppedImage = this.cropper.getCropperImageInCanvasOfSize(this.resizer.imageSize);
        if (croppedImage) {
            const croppedImageAspectRatio = croppedImage.width / croppedImage.height;
            this.resizer.replaceImageWith(croppedImage, croppedImageAspectRatio, {
                matchNewAspectRatio: matchNewAspectRatio
            });
        }
    }

    private processResizerChange(changeType: string, isFinalChange: boolean): void {
        this.computeAndSendIncludegraphicsOptions(changeType, isFinalChange);
    }

    private processCropperChange(changeType: string, isFinalChange: boolean): void {
        this.computeAndSendIncludegraphicsOptions(changeType, isFinalChange);
        this.updateResizerImage();
    }

    private computeIncludegraphicsOptions(): IncludegraphicsOptions {
        const newOptions: IncludegraphicsOptions = {};

        const cropper = this.cropper;
        if (!cropper) {
            console.warn("The options cannot be computed: there is no cropper.");
            return newOptions;
        }

        // Shorthands for some details about the PDF page where the image is displayed
        const pdfPageDetail = this.context.pdfPageDetail!;
        const pdfPageScale = pdfPageDetail.scale;

        // const imageData = cropper.getCanvasData();
        // const cropboxData = cropper.getCropBoxData();

        const imageNode = this.imageNode;
        const naturalImageSize = {
            width: imageNode.naturalWidth,
            height: imageNode.naturalHeight
        };

        const { width, height } = this.resizer.imageSize;
        const trim = this.cropper.imageCropValues;

        // const width = cropboxData.width / pdfPageScale;
        // const height = cropboxData.height / pdfPageScale;

        // const trim = {
        //     left: Math.max(0, cropboxData.left - imageData.left),
        //     bottom: Math.max(0, (imageData.top + imageData.height) - (cropboxData.top + cropboxData.height)),
        //     right: Math.max(0, (imageData.left + imageData.width) - (cropboxData.left + cropboxData.width)),
        //     top: Math.max(0, cropboxData.top - imageData.top),
        // };

        // Compute the new values of the width, height and trim options of the command
        // let width = this.frameDimensions.width;
        // let height = this.frameDimensions.height;
        // const trim = 

        // let imageRight = this.imageOffset.x + (this.imageDimensions.width * this.imageScale);
        // let imageBottom = this.imageOffset.y + (this.imageDimensions.height * this.imageScale);

        // // Take the offset of the image into account
        // if (this.imageOffset.x > 0) {
        //     width -= this.imageOffset.x;
        // }
        // else if (this.imageOffset.x < 0) {
        //     trim.left = -this.imageOffset.x;
        // }

        // if (this.imageOffset.y > 0) {
        //     height -= this.imageOffset.y;
        // }
        // else if (this.imageOffset.y < 0) {
        //     trim.top = -this.imageOffset.y;
        // }

        // // Take the position of the frame into account
        // if (imageRight < this.frameDimensions.width) {
        //     width -= this.frameDimensions.width - imageRight;
        // }
        // else {
        //     trim.right = imageRight - this.frameDimensions.width;
        // }

        // if (imageBottom < this.frameDimensions.height) {
        //     height -= this.frameDimensions.height - imageBottom;
        // }
        // else {
        //     trim.bottom = imageBottom - this.frameDimensions.height;
        // }

        // Set the options which must be set and return the new options object
        newOptions.width = width / pdfPageScale;
        
        const imageRatio = naturalImageSize.width / naturalImageSize.height;
        if (Math.abs(imageRatio - (width / height)) > 0.002) {
            newOptions.height = height / pdfPageScale;
        }

        const imageAreaIsNotZero = (width > 0) && (height > 0); // To test whether the cropbox is entirely outside of the image
        if (imageAreaIsNotZero
        &&  (trim.left !== 0 || trim.bottom !== 0 || trim.right !== 0 || trim.top !== 0)) {
            newOptions.trim = trim;
            newOptions.height = height / pdfPageScale;

            // // Scale the trim values to make them independant from the scale of the visualised image
            // // (which depends on the scale of the PDF page in which it is displayed)
            // const horizontalTrimScale = imageData.naturalWidth / imageData.width / this.scale.x;
            // const verticalTrimScale = imageData.naturalHeight / imageData.height / this.scale.y;

            // trim.left *= horizontalTrimScale;
            // trim.right *= horizontalTrimScale;
            // trim.bottom *= verticalTrimScale;
            // trim.top *= verticalTrimScale;

            // If the trim option is set, the clip option is automatically set as well
            // (required by includegraphics to hide the trimmed area of the image) 
            newOptions.clip = true;
        }

        return newOptions;
    }

    private sendIncludegraphicsOptions(newOptions: IncludegraphicsOptions, changeType: string, isFinalUpdate: boolean): void {
        const message = {
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "set-options",
            notification: {
                newOptions: newOptions,
                changeType: changeType,
                isFinalUpdate: isFinalUpdate
            }
        };

        if (isFinalUpdate) {
            this.messenger.sendMessage(message);
        }
        else {
            this.nonFinalOptionsUpdateThrottler.add(async () => {
                this.messenger.sendMessage(message);
            });
        }
    }

    private computeAndSendIncludegraphicsOptions(changeType: string, isFinalUpdate: boolean): void {
        const newOptions = this.computeIncludegraphicsOptions();
        this.sendIncludegraphicsOptions(newOptions, changeType, isFinalUpdate);
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        const oldImageUri = this.imageUri;
        this.contentNode = newContentNode;

        if (oldImageUri === this.imageUri) {
            this.resizer.processIncludegraphicsOptionsUpdate(this.options);
            this.cropper.processIncludegraphicsOptionsUpdate(this.options);
        }
        else {
            // Start loading/decoding the new image
            this.preloadedImageNode.src = this.imageUri;
            this.preloadedImageNode.decode();

            this.resizer.destroy();
            this.cropper.destroy();

            this.resizer = this.createResizer();
            this.cropper = this.createCropper();

            this.preloadedImageNode.onload = () => {
                this.resizer.display();
                this.cropper.display();
            };
        }
    }

    onAfterVisualisationDisplay(): void {
        super.onAfterVisualisationDisplay();

        this.preloadedImageNode.onload = () => {
            this.resizer.display();
            this.cropper.display();
        };
    }

    onBeforeVisualisationRemoval(): void {
        super.onAfterVisualisationRemoval();
        
        this.resizer.destroy();
        this.cropper.destroy();
    }

    private static extractImageFrom(contentNode: HTMLElement): HTMLImageElement {
        return contentNode.querySelector(".image")! as HTMLImageElement;
    }

    private static extractOptionsFrom(contentNode: HTMLElement): IncludegraphicsOptions {
        // Define a generic function to set a (transformed) value
        // from an attribute of the content node–only if the attribute exists
        function setValueFromAttributeIfItExists<
            T extends object,
            K extends keyof T,
            V extends T[K]
        >(
            valueObject: T,
            valueKey: K,
            attributeName: string,
            valueTransformer: (attrValue: string) => V
        ): void {
            if (contentNode.hasAttribute(attributeName)) {
                valueObject[valueKey] = valueTransformer(contentNode.getAttribute(attributeName)!);
            }
        };

        const options: IncludegraphicsOptions = {};
        setValueFromAttributeIfItExists(options, "width", "data-option-width", parseFloat);
        setValueFromAttributeIfItExists(options, "height", "data-option-height", parseFloat);
        setValueFromAttributeIfItExists(options, "scale", "data-option-scale", parseFloat);

        // Try to read trim values (one for each side of the image)
        const trimValues = {} as Exclude<typeof options.trim, undefined>;
        const sides = ["left", "bottom", "right", "top"] as const;
        for (let side of sides) {
            setValueFromAttributeIfItExists(trimValues, side, `data-option-trim-${side}`, parseFloat);
        }

        // If at least one trim value has been set, the three other trim values should be set as well
        // In this case, the object can be safely assigned to the trim option key
        if (trimValues.left !== undefined) {
            options.trim = trimValues;
        }

        setValueFromAttributeIfItExists(options, "clip", "data-option-clip", value => !!value);

        return options;
    }
}

export class IncludegraphicsViewFactory implements VisualisationViewFactory {
    readonly visualisationName = IncludegraphicsView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext): VisualisationView {
        return new IncludegraphicsView(contentNode, metadata, context);
    }
}