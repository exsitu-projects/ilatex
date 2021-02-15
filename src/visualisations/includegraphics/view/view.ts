import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView, VisualisationViewInstantiationContext } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { VisualisationMetadata } from "../../../shared/visualisations/types";

// 2D dimensions of an element (in pixels)
interface Dimensions {
    width: number;
    height: number;
}

// 2D position of an element (in pixerls)
interface Position {
    x: number;
    y: number;
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

// Return a CSS pixel value (rounded to the closest integer)
function px(length: number): string {
    return `${Math.round(length)}px`;
}

// Return the number of pixels of a CSS length in pixels (without the 'px' suffix)
function nbPx(lengthAsString: string): number {
    return parseFloat(lengthAsString);
}

class IncludegraphicsView extends AbstractVisualisationView {
    static readonly visualisationName = "includegraphics";
    readonly visualisationName = IncludegraphicsView.visualisationName;

    private viewNode: HTMLElement;
    private frameNode: HTMLElement;
    private ghostImageNode: HTMLImageElement;
    private innerNode: HTMLElement;
    private imageNode: HTMLImageElement;
    private resizeHandleNode: HTMLElement;

    private initialIncludegraphicsOptions: IncludegraphicsOptions;

    private imageScale: number;
    private frameDimensions: Dimensions;
    private imageDimensions: Dimensions;
    private imageOffset: Position;

    private somethingIsDragged: boolean;
    private currentDrag: {
        onDragAction: (Event: MouseEvent) => void;
        cursorX: number,
        cursorY: number,
        dx: number,
        dy: number
    };

    private resizeHandleDragStartCallback =
        (event: MouseEvent) => { this.onDragStart(event, this.onResizeHandleDrag.bind(this)); };
    private imageDragStartCallback =
        (event: MouseEvent) => { this.onDragStart(event, this.onImageDrag.bind(this)); };
    private dragCallback =
        (event: MouseEvent) => { this.onDrag(event); };
    private dragEndCallback =
        (event: MouseEvent) => { this.onDragEnd(event); };
    private wheelCallback =
        (event: WheelEvent) => { this.onScroll(event); };

    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext) {
        super(contentNode, metadata, context);

        this.viewNode = document.createElement("div");
        this.viewNode.innerHTML = contentNode.innerHTML;

        this.frameNode = this.viewNode.querySelector(".frame")! as HTMLElement;
        this.ghostImageNode = this.frameNode.querySelector(".ghost")! as HTMLImageElement;
        this.innerNode = this.frameNode.querySelector(".inner")! as HTMLElement;
        this.imageNode = this.innerNode.querySelector(".image")! as HTMLImageElement;
        this.resizeHandleNode = this.frameNode.querySelector(".resize")! as HTMLElement;

        // Extract the options of the command
        this.initialIncludegraphicsOptions = {};
        this.extractIncludegraphicsOptions();

        // Make the dimensions of the frame match those of the annotation mask
        // (since the mask should represent the smallest visible area of the image, by definition)
        const maskCoordinates = this.instanciationContext.annotationMaskCoordinates;
        this.frameDimensions = {
            width: maskCoordinates[2] - maskCoordinates[0],
            height: maskCoordinates[3] - maskCoordinates[1]
        };

        this.updateFrameNodeDimensions();

        // Compute and set the scale, the dimensions and the position of the image
        // by taking into trimming and various scaling factors into account
        this.imageScale = 1;

        const { offset, dimensions } = this.computeImageOffsetAndDimensions();
        this.imageOffset = offset;
        this.imageDimensions = dimensions;

        this.updateImageNodesDimensions();
        this.updateImageNodesPositions();
        
        // Initialise the interaction state
        this.somethingIsDragged = false;
        this.currentDrag = {
            onDragAction: () => {},
            cursorX: 0,
            cursorY: 0,
            dx: 0,
            dy: 0
        };

        this.startHandlingMouseEvents();
    }

    computeImageOffsetAndDimensions(): { offset: Position, dimensions: Dimensions } {
        // Shorthands for (possibly undefined) options of the includegraphics command
        const width = this.initialIncludegraphicsOptions.width;
        const height = this.initialIncludegraphicsOptions.height;
        const scale = this.initialIncludegraphicsOptions.scale;
        const trim = this.initialIncludegraphicsOptions.trim ?? {
            top: 0, bottom: 0, left: 0, right: 0
        };

        // Dimensions of the image once it has been trimmed
        const trimmedNaturalWidth = this.imageNode.naturalWidth - trim.left - trim.right;
        const trimmedNaturalHeight = this.imageNode.naturalHeight - trim.top - trim.bottom;

        // Horizontal and vertical scaling of the trim values
        // i.e. scaling factor between the trim values specified in the command parameters
        // and the actual amount of pixels trimmed in the PDF viewport
        let horizontalTrimScale = 1;
        let verticalTrimScale = 1;

        if (width && !height) {
            const scaleToFitSizeParameter = width / trimmedNaturalWidth;
            horizontalTrimScale = scaleToFitSizeParameter;
            verticalTrimScale = scaleToFitSizeParameter;
        }
        else if (!width && height) {
            const scaleToFitSizeParameter = height / trimmedNaturalHeight;
            horizontalTrimScale = scaleToFitSizeParameter;
            verticalTrimScale = scaleToFitSizeParameter;           
        }
        else if (width && height) {
            horizontalTrimScale = width / trimmedNaturalWidth;
            verticalTrimScale = height / trimmedNaturalHeight;
        }
        else if (scale) {
            console.error("The 'scale' option is not yet supported by the visualisation of the incldudegraphics command.");
            // TODO
        }

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
        const pdfPageScale = this.instanciationContext.pdfPageDetail.scale;
        return {
            offset: {
                x: -scaledTrim.left * pdfPageScale,
                y: -scaledTrim.top * pdfPageScale
            },

            dimensions: {
                width: ((scaledTrim.left + scaledTrim.right) * pdfPageScale) + this.frameDimensions.width,
                height: ((scaledTrim.top + scaledTrim.bottom) * pdfPageScale) + this.frameDimensions.height
            }
        };
    }

    updateFrameNodeDimensions(): void {
        // Resize the frame
        this.frameNode.style.width = px(this.frameDimensions.width);
        this.frameNode.style.height = px(this.frameDimensions.height);

        // Keep the frame centered
        this.frameNode.style.marginLeft = px(-this.frameDimensions.width / 2);

        // Resize the visualisation to make it slightly higher than the frame node
        const padding = 5; // px
        this.viewNode.style.height = px(this.frameDimensions.height + (2 * padding));
    }

    updateImageNodesDimensions(): void {
        // Resize both the image and the ghost image
        // (they must always have the same dimensions and positions)
        const newImageWidth = this.imageDimensions.width * this.imageScale;
        const newImageHeight = this.imageDimensions.height * this.imageScale;

        this.imageNode.style.width = px(newImageWidth);
        this.imageNode.style.height = px(newImageHeight);

        this.ghostImageNode.style.width = px(newImageWidth);
        this.ghostImageNode.style.height = px(newImageHeight);
    }

    updateImageNodesPositions(): void {
        // Re-position both the image and the ghost image
        // (they must always have the same dimensions and positions)
        this.imageNode.style.left = px(this.imageOffset.x);
        this.imageNode.style.top = px(this.imageOffset.y);

        this.ghostImageNode.style.left = px(this.imageOffset.x);
        this.ghostImageNode.style.top = px(this.imageOffset.y);
    }

    extractIncludegraphicsOptions(): void {
        // Define a generic function to set a (transformed) value
        // from an attribute of the content node–only if the attribute exists
        const contentNode = this.contentNode;
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

        const options = this.initialIncludegraphicsOptions;
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

        debugger;
    }

    onImageDrag(event: MouseEvent): void {
        this.imageOffset.x += this.currentDrag.dx;
        this.imageOffset.y += this.currentDrag.dy;
        this.updateImageNodesPositions();
    }

    onResizeHandleDrag(event: MouseEvent): void {
        this.frameDimensions.width += this.currentDrag.dx;
        this.frameDimensions.height += this.currentDrag.dy;
        this.updateFrameNodeDimensions();
    }

    onDragStart(event: MouseEvent, onDragAction: (event: MouseEvent) => void): void {
        event.preventDefault();
        this.somethingIsDragged = true;

        // Set up some information about the drag operation which just started
        this.currentDrag.cursorX = event.screenX;
        this.currentDrag.cursorY = event.screenY;
        this.currentDrag.onDragAction = onDragAction;
    }

    onDrag(event: MouseEvent) {
        if (!this.somethingIsDragged) {
            return;
        }

        event.preventDefault();

        // Update information about the current drag operation
        this.currentDrag.dx = event.screenX - this.currentDrag.cursorX;
        this.currentDrag.dy = event.screenY - this.currentDrag.cursorY;
        this.currentDrag.cursorX = event.screenX;
        this.currentDrag.cursorY = event.screenY;

        this.currentDrag.onDragAction(event);

        const newOptions = this.computeCurrentIncludegraphicsOptions();
        this.updateCommandOptions(newOptions);
    }

    onDragEnd(event: MouseEvent) {
        event.preventDefault();
        this.somethingIsDragged = false;
    }

    onScroll(event: MouseWheelEvent) {
        event.preventDefault();

        // Compute the image scaling factor
        let ds;
        if (event.deltaY > 0) { 
            // Enlarge the image
            ds = 1 + event.deltaY / 50;
        }
        else if (event.deltaY < 0) {
            // Shrink the image
            ds = 1 / (1 - event.deltaY / 50);
        }
        else {
            return;
        }

        // If the different is significant, set the new scale and update the view and the document
        const newImageScale = this.imageScale * ds;
        if (newImageScale > 0.1) {
            this.imageScale = newImageScale;

            this.updateImageNodesDimensions();
            
            const newOptions = this.computeCurrentIncludegraphicsOptions();
            this.updateCommandOptions(newOptions);
        }
    }

    startHandlingMouseEvents(): void {
        // Start a different type of drag operation depending on the target of the mouse event
        this.ghostImageNode.addEventListener("mousedown", this.imageDragStartCallback);
        this.imageNode.addEventListener("mousedown", this.imageDragStartCallback);
        this.resizeHandleNode.addEventListener("mousedown", this.resizeHandleDragStartCallback);

        // Listen for moves and button releases all over the document
        // to enable the user to keep/stop draging something outside of the view node
        document.addEventListener("mousemove", this.dragCallback);
        document.addEventListener("mouseup", this.dragEndCallback);

        // Enable image scaling using the mouse wheel
        this.viewNode.addEventListener("wheel", this.wheelCallback);
    }

    stopHandlingMousEvents(): void {
        this.ghostImageNode.removeEventListener("mousedown", this.imageDragStartCallback);
        this.imageNode.removeEventListener("mousedown", this.imageDragStartCallback);
        this.resizeHandleNode.removeEventListener("mousedown", this.resizeHandleDragStartCallback);

        document.removeEventListener("mousemove", this.dragCallback);
        document.removeEventListener("mouseup", this.dragEndCallback);

        this.viewNode.removeEventListener("wheel", this.wheelCallback);        
    }

    computeCurrentIncludegraphicsOptions(): IncludegraphicsOptions {
        const newOptions: IncludegraphicsOptions = {};

        // Compute the new values of the width, height and trim options of the command
        let width = this.frameDimensions.width;
        let height = this.frameDimensions.height;
        const trim = { left: 0, bottom: 0, right: 0, top: 0 };

        let imageRight = this.imageOffset.x + (this.imageDimensions.width * this.imageScale);
        let imageBottom = this.imageOffset.y + (this.imageDimensions.height * this.imageScale);

        // Take the offset of the image into account
        if (this.imageOffset.x > 0) {
            width -= this.imageOffset.x;
        }
        else if (this.imageOffset.x < 0) {
            trim.left = -this.imageOffset.x;
        }

        if (this.imageOffset.y > 0) {
            height -= this.imageOffset.y;
        }
        else if (this.imageOffset.y < 0) {
            trim.top = -this.imageOffset.y;
        }

        // Take the position of the frame into account
        if (imageRight < this.frameDimensions.width) {
            width -= this.frameDimensions.width - imageRight;
        }
        else {
            trim.right = imageRight - this.frameDimensions.width;
        }

        if (imageBottom < this.frameDimensions.height) {
            height -= this.frameDimensions.height - imageBottom;
        }
        else {
            trim.bottom = imageBottom - this.frameDimensions.height;
        }

        // Set the options which must be set and return the new options object
        newOptions.width = Math.max(0, width / this.instanciationContext.pdfPageDetail.scale);
        newOptions.height = Math.max(0, height / this.instanciationContext.pdfPageDetail.scale);
        const imageAreaIsNotZero = (newOptions.width > 0) && (newOptions.height > 0);

        if (imageAreaIsNotZero
        &&  (trim.left !== 0 || trim.bottom !== 0 || trim.right !== 0 || trim.top !== 0)) {
            newOptions.trim = trim;

            // Scale the trim values to make them independant from the scale of the visualised image
            // (which depends on the scale of the PDF page in which it is displayed)
            const horizontalTrimScale = (1 / this.imageDimensions.width)
                                      * (this.imageNode.naturalWidth / this.imageScale);
            const verticalTrimScale = (1 / this.imageDimensions.height)
                                    * (this.imageNode.naturalHeight / this.imageScale);

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

    updateCommandOptions(newOptions: IncludegraphicsOptions): void {
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "set-options",
            notification: {
                newOptions: newOptions
            }
        });
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        // TODO: implement
    }

    onBeforeVisualisationDisappearance(): void {
        this.stopHandlingMousEvents();
    }
}

export class IncludegraphicsViewFactory implements VisualisationViewFactory {
    readonly visualisationName = IncludegraphicsView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewInstantiationContext): VisualisationView {
        return new IncludegraphicsView(contentNode, metadata, context);
    }
}