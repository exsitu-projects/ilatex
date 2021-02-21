import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { ImageResizer } from "./ImageResizer";
import { IncludegraphicsOptions } from "./view";

export interface ImageSize {
    width: number; // px
    height: number; // px
}

export abstract class ImageEditor {
    protected readonly viewContext: VisualisationViewContext;
    protected readonly containerNode: HTMLElement;

    protected readonly preloadedImageNode: HTMLImageElement;
    protected readonly imageUri: string;
    protected naturalImageSize: ImageSize;
    protected options: IncludegraphicsOptions;

    private changeCallback: (isFinalChange: boolean) => void;

    constructor(
        imageNode: HTMLImageElement,
        containerNode: HTMLElement,
        initialOptions: IncludegraphicsOptions,
        viewContext: VisualisationViewContext,
        changeCallback: (isFinalChange: boolean) => void
    ) {
        this.viewContext = viewContext;
        this.containerNode = containerNode;

        this.preloadedImageNode = imageNode;
        this.imageUri = imageNode.src;
        this.naturalImageSize = ImageEditor.extractNaturalImageSizeFrom(imageNode);
        this.options = initialOptions;

        this.changeCallback = changeCallback;
    }

    abstract display(): void;
    abstract destroy(): void;

    protected abstract onIncludegraphicsOptionsUpdate(): void;
    protected abstract onWebviewResize(): void;

    processIncludegraphicsOptionsUpdate(newOptions: IncludegraphicsOptions): void {
        this.options = newOptions;
        this.onIncludegraphicsOptionsUpdate();
    }

    protected notifyChange(isFinalChange: boolean): void{
        this.changeCallback(isFinalChange);
    }

    protected static extractNaturalImageSizeFrom(imageNode: HTMLImageElement): ImageSize {
        return {
            width: imageNode.naturalWidth,
            height: imageNode.naturalHeight,
        };
    }

    protected static extractImageSizeFrom(
        options: IncludegraphicsOptions,
        naturalImageSize: ImageSize,
        pdfPageScale: number
    ): ImageSize {
        // Shorthands for (possibly undefined) options of the includegraphics command
        const widthOption = options.width;
        const heightOption = options.height;
        const scaleOption = options.scale;
        const trim = options.trim ?? {
            top: 0, bottom: 0, left: 0, right: 0
        };

        // Natural width, height and ratio
        const naturalWidth = naturalImageSize.width;
        const naturalHeight = naturalImageSize.height;
        const naturalRatio = naturalWidth / naturalHeight;

        // Trimmed width, height and ratio
        const trimmedNaturalWidth = naturalWidth - trim.left - trim.right;
        const trimmedNaturalHeight = naturalHeight - trim.top - trim.bottom;
        const trimmedNaturalRatio = trimmedNaturalWidth / trimmedNaturalHeight;

        let imageWidthInPdf = 0;
        let imageHeightInPdf = 0;

        if (widthOption && !heightOption) {
            imageWidthInPdf = widthOption * pdfPageScale;
            imageHeightInPdf = imageWidthInPdf / trimmedNaturalRatio;
        }
        else if (!widthOption && heightOption) {
            imageHeightInPdf = heightOption * pdfPageScale;
            imageWidthInPdf = imageHeightInPdf * trimmedNaturalRatio;
        }
        else if (widthOption && heightOption) {
            imageWidthInPdf = widthOption * pdfPageScale;
            imageHeightInPdf = heightOption * pdfPageScale;
        }
        else {
            const optionOrDefaultScale = scaleOption ?? 1;
            imageWidthInPdf = naturalWidth * optionOrDefaultScale * pdfPageScale;
            imageHeightInPdf = naturalHeight * optionOrDefaultScale * pdfPageScale;
        }

        return {
            width: imageWidthInPdf,
            height: imageHeightInPdf
        };
    }    
}