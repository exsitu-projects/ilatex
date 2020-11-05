import * as pdfjs from "./PdfJsApi";
import { VisualisationPopup } from "../visualisations/VisualisationPopup";
import { VisualisationViewManager, VisualisationDisplayRequest } from "../visualisations/VisualisationViewManager";

export type AnnotationMaskCoordinates = [
    number, // x1
    number, // y1
    number, // x2
    number  // y2
];

export class PDFPageRenderer {
    // Pixel ratio of the user's device
    private static readonly DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1.0;

    private page: pdfjs.PDFPage;
    private pageNumber: number;

    private canvas: HTMLCanvasElement | null;
    private canvasContext: any | null;
    private renderingTask?: pdfjs.PDFRenderTask | null;

    private transformMatrix: [number, number, number, number, number, number];
    private viewport: pdfjs.PDFPageViewmport | null;

    private annotations: pdfjs.PDFAnnotation[];
    private visualisationAnnotations: pdfjs.PDFAnnotation[];
    private visualisationAnnotationMaskNodes: HTMLElement[];

    constructor(page: pdfjs.PDFPage, pageNumber: number) {
        this.page = page;
        this.pageNumber = pageNumber;

        // Canvas to draw the page onto and its 2D context
        this.canvas = null;
        this.canvasContext = null;

        // Structures for the page renderer
        this.renderingTask = null;
        this.transformMatrix = [PDFPageRenderer.DEVICE_PIXEL_RATIO, 0, 0,
                                PDFPageRenderer.DEVICE_PIXEL_RATIO, 0, 0];
        this.viewport = null;

        // PDF annotations
        this.annotations = [];
        this.visualisationAnnotations = [];

        // Masks for visualisation annotations (DOM nodes acting as masks to detect events,
        // positionned on top of the annotations, in absolute webpage coordinates)
        this.visualisationAnnotationMaskNodes = [];
    }

    private async init(): Promise<void> {
        await this.extractAnnotations();
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    getAnnotationMasks(): HTMLElement[] {
        return this.visualisationAnnotationMaskNodes;
    }

    private createCanvas(): void {
        this.canvas = document.createElement("canvas");
        this.canvasContext = this.canvas.getContext("2d");
    }

    private computeViewport(): void {
        // TODO: use the same scale for all pages? or display it somewhere?
        const webviewWidth = document.body.clientWidth;
        const pageWidth = this.page.view[2];
        const scale = webviewWidth / pageWidth;

        this.viewport = this.page.getViewport({
            scale: scale
        });
    }
    
    private setCanvasAttributes(): void {
        // Both the canvas and the viewport must be available to set the attributes of the canvas
        if (!this.canvas || !this.viewport) {
            console.error("A canvas and a viewport are required to set the canvas' attributes.");
            return;
        }

        this.canvas.classList.add("pdf-page");
        this.canvas.setAttribute("data-page-number", this.pageNumber.toString());

        this.canvas.setAttribute("data-viewport-width", this.viewport.width.toString());
        this.canvas.setAttribute("data-viewport-height", this.viewport.height.toString());
        this.canvas.setAttribute("data-viewport-scale", this.viewport.scale.toString());
    }

    private resizeCanvas(): void {
        // Both the canvas and the viewport must be available to resize the canvas
        if (!this.canvas || !this.viewport) {
            console.error("A canvas and a viewport are required to resize the canvas.");
            return;
        }

        // Make the dimensions of the canvas match those of the page
        this.canvas.width = this.viewport.width * PDFPageRenderer.DEVICE_PIXEL_RATIO;
        this.canvas.height = this.viewport.height * PDFPageRenderer.DEVICE_PIXEL_RATIO;

        this.canvas.style.width = `${this.viewport.width}px`;
        this.canvas.style.height = `${this.viewport.height}px`;
    }

    private async extractAnnotations(): Promise<void> {
        this.annotations = await this.page.getAnnotations();
        this.visualisationAnnotations = this.annotations.filter(annotation => {
            return annotation.annotationType === 20 // tooltip
                && annotation.alternativeText.startsWith("ilatex-code-mapping-id");
        });
    }

    // Warning: this method requires the canvas to be appended in the DOM
    // to retrieve the correct absolute coordinates
    createAnnotationMasks(): void {
        for (let annotation of this.visualisationAnnotations) {
            // Extract the code mapping ID from the visualisation
            const [_, codeMappingIdString] = annotation.alternativeText.match(/[^\d]+(\d+)/);
            const codeMappingId = parseInt(codeMappingIdString);

            const maskNode = document.createElement("div");
            maskNode.classList.add("annotation-mask");
            maskNode.setAttribute("data-page-number", this.pageNumber.toString());
            maskNode.setAttribute("data-code-mapping-id", codeMappingIdString);

            // Set the position and the size of the mask
            const maskCoordinates = this.convertPdfRectToAbsoluteWebpageRect(annotation.rect);
            const [x1, y1, x2, y2] = maskCoordinates;
            maskNode.style.top = `${y1}px`;
            maskNode.style.left = `${x1}px`;
            maskNode.style.width = `${x2 - x1}px`;
            maskNode.style.height = `${y2 - y1}px`;

            // Handle clicks on this mask
            maskNode.addEventListener("click", event => {
                this.handleAnnotationMaskClick(codeMappingId, maskCoordinates);
            });

            this.visualisationAnnotationMaskNodes.push(maskNode);
        }
    }

    removeAnnotationMasks(): void {
        for (let maskNode of this.visualisationAnnotationMaskNodes) {
            maskNode.remove();
        }

        this.visualisationAnnotationMaskNodes = [];
    }

    private async drawPage(): Promise<void> {
        // Use the device pixel ratio and the transform property
        // to make the PDF look crisp on HDPI displays
        // (cf. https://github.com/mozilla/pdf.js/issues/10509#issuecomment-585062007)
        this.renderingTask = this.page.render({
            canvasContext: this.canvasContext,
            viewport: this.viewport,
            transform: this.transformMatrix
        });

        try {
            await this.renderingTask.promise;
        }
        catch(error) {
            // Silently fail in case of an error

            // Note: canceling the rendering on purpose will throw an error
            // (e.g. in order to re-render a more recent version of the PDF
            // while the previous version is still being rendered)
        }
        finally {
            this.renderingTask = null;
        }
    }

    // convertPdfRectToCanvasRect(pdfRect) {
    //     // In addition to the transform matrix of the viewport,
    //     // the scaling must be further adapted to take the HDPI fix into account
    //     const viewportTransform = this.viewport.transform;
    //     const adaptX = x => PDFPageRenderer.DEVICE_PIXEL_RATIO * ((x * viewportTransform[0]) + viewportTransform[2]);
    //     const adaptY = y => PDFPageRenderer.DEVICE_PIXEL_RATIO * ((y * viewportTransform[3]) + viewportTransform[5]);
        
    //     // y1 and y2 must be swapped to change the origin from bottom-left to top-left 
    //     const [x1, y1, x2, y2] = pdfRect;
    //     return [adaptX(x1), adaptY(y2), adaptX(x2), adaptY(y1)];
    // }

    // Warning: this method requires the canvas to be appended in the DOM
    // to retrieve the correct absolute coordinates
    private convertPdfRectToAbsoluteWebpageRect(pdfRect: pdfjs.PDFRect): AnnotationMaskCoordinates {
        // The canvas to be appended in the DOM to retrieve the correct absolute coordinates
        if (!this.canvas || !document.body.contains(this.canvas)) {
            console.error("The canvas must be part of the DOM to convert PDF coordinates to page coordinates.");
            return pdfRect;
        }

        // Since the canvas element itself is not scaled up (only its content is),
        // the HDPI fix does not have to be taken into account here.
        // However, the current scroll of the page must be considered
        // since it affects the DOMRect returned by getBoudingClientRect().
        const canvasRect = this.canvas.getBoundingClientRect();
        const viewportTransform = this.viewport.transform;
        const adaptX = (x: number) => ((x * viewportTransform[0]) + viewportTransform[2])
                                      + canvasRect.left
                                      + window.scrollX;
        const adaptY = (y: number) => ((y * viewportTransform[3]) + viewportTransform[5])
                                      + canvasRect.top 
                                      + window.scrollY;
        
        // y1 and y2 must be swapped to change the origin from bottom-left to top-left 
        const [x1, y1, x2, y2] = pdfRect;
        return [adaptX(x1), adaptY(y2), adaptX(x2), adaptY(y1)];    
    }

    // drawAnnotationFrames(annotations) {
    //     this.canvasContext.save();
        
    //     this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    //     this.canvasContext.lineWidth = 3;
    //     this.canvasContext.strokeStyle = "#0074D9";

    //     for (let annotation of annotations) {
    //         let [x1, y1, x2, y2] = this.convertPdfRectToCanvasRect(annotation.rect);
    //         this.canvasContext.strokeRect(
    //             x1,
    //             y1,
    //             x2 - x1,
    //             y2 - y1
    //         );
    //     }
    
    //     this.canvasContext.restore();
    // }

    async redraw(): Promise<void> {
        // Cancel the current rendering task (if any)
        if (this.renderingTask) {
            this.renderingTask.cancel();
        }

        // PDF.js requires every new rendering task to be performed on a fresh canvas
        // (see e.g. https://github.com/mozilla/pdf.js/issues/10576)
        this.createCanvas();
        this.computeViewport();
        this.setCanvasAttributes();
        this.resizeCanvas();

        await this.drawPage();
        // this.drawAnnotationFrames(this.annotations);
        // this.drawAnnotationFrames(this.visualisationAnnotations);
    }

    private handleAnnotationMaskClick(codeMappingId: number, maskCoordinates: AnnotationMaskCoordinates): void {
        const event = new CustomEvent<VisualisationDisplayRequest>(
            VisualisationViewManager.REQUEST_VISUALISATION_DISPLAY_EVENT,
            {
                detail: {
                    codeMappingId: codeMappingId,
                    annotationMaskCoordinates: maskCoordinates,
                    pdfPageDetail: {
                        pageNumber: this.pageNumber,
                        width: this.viewport.width,
                        height: this.viewport.height,
                        scale: this.viewport.scale,
                    }
                }
            }
        );

        window.dispatchEvent(event);
    }

    static async loadFrom(pdf: pdfjs.PDFDocument, pageNumber: number): Promise<PDFPageRenderer> {
        const page = await pdf.getPage(pageNumber);

        const displayablePage = new PDFPageRenderer(page, pageNumber);
        await displayablePage.init();

        return displayablePage;
    }
}
