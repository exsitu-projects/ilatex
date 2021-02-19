import "./CropperjsApi";
import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { VisualisationMetadata } from "../../../shared/visualisations/types";
import { TaskThrottler } from "../../../shared/tasks/TaskThrottler";
import { TaskDebouncer } from "../../../shared/tasks/TaskDebouncer";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";

// 2D dimensions of an element (in pixels)


// interface TrimValues {
//     top: number;
//     bottom: number;
//     left: number;
//     right: number;
// }

// // 2D position of an element (in pixerls)
// interface Position {
//     x: number;
//     y: number;
// }

interface Dimensions {
    width: number;
    height: number;
}

interface BoundingBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface ImageDimensionData {
    bb: BoundingBox,
    widthInPdf: number;
    heightInPdf: number;
    scaleX: number;
    scaleY: number;
}

interface IncludegraphicsOptions {
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
    private static readonly WAITING_TIME_AFTER_LAST_SCROLL_BEFORE_OPTIONS_UPDATE = 500; // ms
    static readonly visualisationName = "includegraphics";
    readonly visualisationName = IncludegraphicsView.visualisationName;

    private viewNode: HTMLElement;
    private imageUri: string | null;
    private cropper: Cropper | null;
    // private imageNode: HTMLImageElement;

    
    // private initialIncludegraphicsOptions: IncludegraphicsOptions;
    // private frameDimensions: Dimensions;
    // private imageDimensions: Dimensions;
    // private imageOffset: Position;

    private nonFinalOptionsUpdateThrottler: TaskThrottler;
    private onScrollFinalOptionsUpdateDebouncer: TaskDebouncer;


    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext) {
        super(contentNode, metadata, context);

        this.viewNode = document.createElement("div");
        this.imageUri = null;
        this.cropper = null;
        

        // Make the dimensions of the frame match those of the annotation mask
        // (since the mask should represent the smallest visible area of the image, by definition)
        // const maskCoordinates = this.instanciationContext.annotationMaskCoordinates;
        // this.frameDimensions = {
        //     width: maskCoordinates[2] - maskCoordinates[0],
        //     height: maskCoordinates[3] - maskCoordinates[1]
        // };

        this.nonFinalOptionsUpdateThrottler = new TaskThrottler(IncludegraphicsView.DELAY_BETWEEN_NON_FINAL_OPTIONS_UPDATES);
        this.onScrollFinalOptionsUpdateDebouncer = new TaskDebouncer(IncludegraphicsView.WAITING_TIME_AFTER_LAST_SCROLL_BEFORE_OPTIONS_UPDATE);
    }

    private computeImageBoundingBoxFrom(
        imageNode: HTMLImageElement,
        options: IncludegraphicsOptions
    ): ImageDimensionData {
        // Shorthands for some details about the PDF page where the image is displayed
        const pdfPageDetail = this.instanciationContext.pdfPageDetail!;
        const pdfPageScale = pdfPageDetail.scale;

        // Shorthands for (possibly undefined) options of the includegraphics command
        const width = options.width;
        const height = options.height;
        const scale = options.scale;
        const trim = options.trim ?? {
            top: 0, bottom: 0, left: 0, right: 0
        };

        // Natural width, height and ratio
        const naturalWidth = imageNode.naturalWidth;
        const naturalHeight = imageNode.naturalHeight;
        // const naturalRatio = naturalWidth / naturalHeight;

        // Dimensions of the image once it has been trimmed
        const trimmedNaturalWidth = naturalWidth - trim.left - trim.right;
        const trimmedNaturalHeight = naturalHeight - trim.top - trim.bottom;
        const trimmedNaturalRatio = trimmedNaturalWidth / trimmedNaturalHeight;

        // Horizontal and vertical scaling of the trim values
        // i.e. scaling factor between the trim values specified in the command parameters
        // and the actual amount of pixels trimmed in the PDF viewport
        let horizontalTrimScale = 1;
        let verticalTrimScale = 1;

        // Actual width and height of the image in the PDF (with current scaling)
        let imageWidthInPdf = 0;
        let imageHeightInPdf = 0;

        let scaleX = 1;
        let scaleY = 1;

        debugger;

        if (width && !height) {
            const scaleToFitSizeParameter = width / trimmedNaturalWidth;
            horizontalTrimScale = scaleToFitSizeParameter;
            verticalTrimScale = scaleToFitSizeParameter;

            imageWidthInPdf = width * pdfPageScale;
            imageHeightInPdf = imageWidthInPdf / trimmedNaturalRatio;
        }
        else if (!width && height) {
            const scaleToFitSizeParameter = height / trimmedNaturalHeight;
            horizontalTrimScale = scaleToFitSizeParameter;
            verticalTrimScale = scaleToFitSizeParameter;

            imageHeightInPdf = height * pdfPageScale;
            imageWidthInPdf = imageHeightInPdf * trimmedNaturalRatio;
        }
        else if (width && height) {
            horizontalTrimScale = width / trimmedNaturalWidth;
            verticalTrimScale = height / trimmedNaturalHeight;

            imageWidthInPdf = width * pdfPageScale;
            imageHeightInPdf = height * pdfPageScale;

            const ratio = imageWidthInPdf / imageHeightInPdf;
            const ratioDifference = ratio - trimmedNaturalRatio;
            if (Math.abs(ratioDifference) > 0.005) {
                if (ratioDifference > 0) {
                    scaleX = 1 + Math.abs(ratioDifference); // expand horizontally
                }
                else {
                    scaleY = 1 + Math.abs(ratioDifference); // expand vertically
                }
            }
        }
        else {
            const optionOrDefaultScale = scale ?? 1;

            horizontalTrimScale = (naturalWidth * optionOrDefaultScale) / trimmedNaturalWidth;
            verticalTrimScale = (naturalHeight * optionOrDefaultScale) / trimmedNaturalHeight;

            // TODO: check whether trim values should be substracted from the inagw width/height in the PDF
            // (as when either the width or the height options is lacking, cf. above)
            imageWidthInPdf = naturalWidth * optionOrDefaultScale * pdfPageScale;
            imageHeightInPdf = naturalHeight * optionOrDefaultScale * pdfPageScale;
        }

        debugger;

        // Trim values are given in px (possibly converted from the source code)
        // and must therefore be scaled to match the size of the pixels of the rendered PDF
        // (since the PDF is scaled to fit in the canvas, they may be of different sizes)
        const scaledTrim = {
            top: trim.top * verticalTrimScale,
            bottom: trim.bottom * verticalTrimScale,
            left: trim.left * horizontalTrimScale,
            right: trim.right * horizontalTrimScale
        };

        // Finally compute the initial dimensions and position of the image
        // using the scaled trim values and the scale of the rendered PDF
        return {
            bb: {
                left: -scaledTrim.left * pdfPageScale,
                top: -scaledTrim.top * pdfPageScale,
                width: (((scaledTrim.left + scaledTrim.right) * pdfPageScale) + imageWidthInPdf) / scaleX,
                height: (((scaledTrim.top + scaledTrim.bottom) * pdfPageScale) + imageHeightInPdf) / scaleY
            },
            widthInPdf: imageWidthInPdf,
            heightInPdf: imageHeightInPdf,
            scaleX: scaleX,
            scaleY: scaleY
        };
    }

    private createCropper(imageNode: HTMLImageElement, imageBoundingBox: ImageDimensionData): Cropper {
        return new Cropper(imageNode, {
            guides: false,
            center: false,
            highlight: false,
            rotatable: false,
            viewMode: 1,
            dragMode: "move",
            autoCropArea: 0.5,
            toggleDragModeOnDblclick: false,

            // crop: event => {
            //     if (event.detail.)
            // },

            zoom: event => {
                // console.log("Zoom event", event);
                this.onScrollFinalOptionsUpdateDebouncer.add(async () => {
                    this.computeAndSendIncludegraphicsOptions(true);
                });
            },

            cropmove: event => {
                // console.log("Crop move event", event);
                this.onCropboxChange(event);
            },

            cropend: event => {
                // console.warn("Crop end event", event);
                this.onCropboxChangeEnd(event);
            },

            ready: event => {
                this.updateCropperImageAndCropbox(imageBoundingBox);
            }
        });
    }

    private updateCropperImageAndCropbox(imageBoundingBox: ImageDimensionData): void {
        const cropper = this.cropper;
        if (!cropper) {
            console.warn("The image/cropbox of the cropper cannot be updated: there is no cropper.");
            return;
        }
        
        const viewNodeBox = this.viewNode.getBoundingClientRect();
        const centeredCropboxLeft = (viewNodeBox.width - imageBoundingBox.widthInPdf) / 2;
        const centeredCropboxTop = (viewNodeBox.height - imageBoundingBox.heightInPdf) / 2;

        cropper.setCanvasData({
            width: imageBoundingBox.bb.width,
            height: imageBoundingBox.bb.height,

            left: centeredCropboxLeft + imageBoundingBox.bb.left,
            top: centeredCropboxTop + imageBoundingBox.bb.top
        });

        cropper.setCropBoxData({
            // Make the cropbox as big as the image in the PDF
            width: imageBoundingBox.widthInPdf,
            height: imageBoundingBox.heightInPdf,

            // Center the cropbox
            left: centeredCropboxLeft,
            top: centeredCropboxTop
        });

        cropper.scale(imageBoundingBox.scaleX, imageBoundingBox.scaleY);

        // debugger;
    }

    private destroyCropper(): void {
        this.cropper?.destroy();
        this.cropper = null;
    }

    private onCropboxChange(event: Cropper.CropMoveEvent): void {
        this.computeAndSendIncludegraphicsOptions(false);

        // If the user is dragging one of the bottom cropbox handles,
        // update the height of the view node to ensure the user
        // has always enough space to increase the size of the cropbox
        const isResizingBottomOfCropbox = ["se", "s", "sw"].includes(event.detail.action);
        if (isResizingBottomOfCropbox) {
            const margin = 10; // px
            const cropboxData = this.cropper!.getCropBoxData();

            const newHeightInPx = `${cropboxData.top + cropboxData.height + margin}px`;
            this.viewNode.style.height = newHeightInPx;

            // Use a method of the Cropper instance that is normally not exposed to the user
            // in order to force it to update itself to process the change of the size of the view node
            (this.cropper as any).onResize();
        }
    }

    private onCropboxChangeEnd(event: Cropper.CropEndEvent): void {
        this.computeAndSendIncludegraphicsOptions(true);
    }

    private updateViewNodeFrom(contentNode: HTMLElement): void {
        const newImageNode = contentNode.querySelector(".image")?.cloneNode() as HTMLImageElement;
        if (!newImageNode) {
            console.warn("The cropper cannot be created/updated: no image was found in the content node.");
            return;
        }

        // Despite the very purpose of the decode() method used below,
        // it seems that the webview of VS Code requires the image
        // to be attached to the DOM to work properly
        // (otherwise, the promise is rejected...)
        this.viewNode.append(newImageNode);

        newImageNode.decode().then(
            () => {
                const options = IncludegraphicsView.extractOptionsFrom(contentNode);
                const imageBoundingBox = this.computeImageBoundingBoxFrom(newImageNode, options);

                if (this.cropper) {
                    this.destroyCropper();
                }

                this.viewNode.innerHTML = "";
                this.viewNode.append(newImageNode);

                this.cropper = this.createCropper(newImageNode, imageBoundingBox);
                this.imageUri = newImageNode.src;

                console.info("created!", newImageNode, this.cropper)
            },
            () => {
                console.warn("The cropper cannot be created/updated: the image could not be pre-loaded.");
            },
        );
    }

    private computeIncludegraphicsOptions(): IncludegraphicsOptions {
        const newOptions: IncludegraphicsOptions = {};

        const cropper = this.cropper;
        if (!cropper) {
            console.warn("The options cannot be computed: there is no cropper.");
            return newOptions;
        }

        // Shorthands for some details about the PDF page where the image is displayed
        const pdfPageDetail = this.instanciationContext.pdfPageDetail!;
        const pdfPageScale = pdfPageDetail.scale;

        const imageData = cropper.getCanvasData();
        const cropboxData = cropper.getCropBoxData();

        const width = cropboxData.width / pdfPageScale;
        const height = cropboxData.height / pdfPageScale;

        const trim = {
            left: Math.max(0, cropboxData.left - imageData.left),
            bottom: Math.max(0, (imageData.top + imageData.height) - (cropboxData.top + cropboxData.height)),
            right: Math.max(0, (imageData.left + imageData.width) - (cropboxData.left + cropboxData.width)),
            top: Math.max(0, cropboxData.top - imageData.top),
        };

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
        newOptions.width = width;
        
        const imageRatio = imageData.naturalWidth / imageData.naturalHeight;
        if (Math.abs(imageRatio - (width / height)) > 0.005) {
            newOptions.height = height;
        }

        const imageAreaIsNotZero = (width > 0) && (height > 0); // To test whether the cropbox is entirely outside of the image
        if (imageAreaIsNotZero
        &&  (trim.left !== 0 || trim.bottom !== 0 || trim.right !== 0 || trim.top !== 0)) {
            newOptions.trim = trim;

            // Scale the trim values to make them independant from the scale of the visualised image
            // (which depends on the scale of the PDF page in which it is displayed)
            const horizontalTrimScale = imageData.naturalWidth / imageData.width;
            const verticalTrimScale = imageData.naturalHeight / imageData.height;

            trim.left *= horizontalTrimScale;
            trim.right *= horizontalTrimScale;
            trim.bottom *= verticalTrimScale;
            trim.top *= verticalTrimScale;

            // If the trim option is set, the clip option is automatically set as well
            // (required by includegraphics to hide the trimmed area of the image) 
            newOptions.clip = true;
        }

        return newOptions;
    }

    private sendIncludegraphicsOptions(newOptions: IncludegraphicsOptions, isFinalUpdate: boolean): void {
        const message = {
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "set-options",
            notification: {
                newOptions: newOptions,
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

    private computeAndSendIncludegraphicsOptions(isFinalUpdate: boolean): void {
        const newOptions = this.computeIncludegraphicsOptions();
        this.sendIncludegraphicsOptions(newOptions, isFinalUpdate);
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;
        this.updateViewNodeFrom(this.contentNode);
    }

    onAfterVisualisationDisplay(): void {
        this.updateViewNodeFrom(this.contentNode);
    }

    onBeforeVisualisationRemoval(): void {
        this.destroyCropper();
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
        const sides: ["left", "bottom", "right", "top"] = ["left", "bottom", "right", "top"];
        for (let side of sides) {
            setValueFromAttributeIfItExists(trimValues, side, `data-option-trim-${side}`, parseFloat);
        }

        // If at least one trim value has been set, the three other trim values should be set as well
        // In this case, the object can be safely assigned to the trim option key
        if (trimValues.left !== undefined) {
            options.trim = trimValues;
        }

        setValueFromAttributeIfItExists(options, "clip", "data-option-clip", value => !!value);

        console.log("extracted options", options)
        return options;
    }
}

export class IncludegraphicsViewFactory implements VisualisationViewFactory {
    readonly visualisationName = IncludegraphicsView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext): VisualisationView {
        return new IncludegraphicsView(contentNode, metadata, context);
    }
}