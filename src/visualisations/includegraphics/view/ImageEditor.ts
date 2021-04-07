import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
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

    private changeCallback: (changeType: string, isFinalChange: boolean) => void;

    constructor(
        imageNode: HTMLImageElement,
        containerNode: HTMLElement,
        initialOptions: IncludegraphicsOptions,
        viewContext: VisualisationViewContext,
        changeCallback: (changeType: string, isFinalChange: boolean) => void
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

    processIncludegraphicsOptionsUpdate(newOptions: IncludegraphicsOptions): void {
        this.options = newOptions;
        this.onIncludegraphicsOptionsUpdate();
    }

    protected notifyChange(changeType: string, isFinalChange: boolean): void{
        this.changeCallback(changeType, isFinalChange);
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
    
    // Adapt one dimension of the given size to match the given aspect ratio
    // The height is the adapted dimension by default; this can be changed by using the adaptWith flag
    protected static adaptImageSizeToMatchAspectRatio(size: ImageSize, aspectRatio: number, adaptWidth: boolean = false): ImageSize {
        if (adaptWidth) {
            return {
                width: size.height * aspectRatio,
                height: size.height
            };
        }

        return {
            width: size.width,
            height: size.width / aspectRatio
        };
    }
}