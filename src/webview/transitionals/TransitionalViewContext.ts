import { Messenger } from "../Messenger";
import { AnnotationMaskCoordinates } from "../pdf/PDFPageRenderer";

export interface PdfPageDetail {
    pageNumber: number;
    width: number;
    height: number;
    scale: number;
}

export class TransitionalViewContext {
    readonly messenger: Messenger;
    readonly initialAnnotationMaskCoordinates: AnnotationMaskCoordinates;
    readonly initialPdfPageDetail: PdfPageDetail;

    // Some useful data for fetching updated mask coordinates and PDF page details
    private pdfPageNumber: number;
    private codeMappingId: number;

    constructor(
        codeMappingId: number,
        messenger: Messenger,
        annotationMaskCoordinates: AnnotationMaskCoordinates,
        pdfPageDetail: PdfPageDetail,
    ) {
        this.messenger = messenger;
        this.initialAnnotationMaskCoordinates = annotationMaskCoordinates;
        this.initialPdfPageDetail = pdfPageDetail;

        this.pdfPageNumber = pdfPageDetail.pageNumber;
        this.codeMappingId = codeMappingId;
    }

    private get pdfPageNode(): HTMLElement | null {
        const node = document.body
            .querySelector(`#pdf-container .pdf-page-container .pdf-page[data-page-number="${this.pdfPageNumber}"]`);

        if (!node) {
            console.warn(`The node of PDF page ${this.pdfPageNumber} could not be found.`);
            return null;
        }

        return node as HTMLElement;
    }

    private get annotationMaskNode(): HTMLElement | null {
        const node = document.body
            .querySelector(`#pdf-container .pdf-annotation-mask-container .annotation-mask[data-code-mapping-id="${this.codeMappingId}"]`);

        if (!node) {
            console.warn(`The node of the annotation mask with code mapping ID "${this.pdfPageNumber}" could not be found.`);
            return null;
        }

        return node as HTMLElement;
    }

    get annotationMaskCoordinates(): AnnotationMaskCoordinates | null {
        const annotationMaskNode = this.annotationMaskNode;
        if (!annotationMaskNode) {
            return null;
        }

        const annotationMaskBox = annotationMaskNode.getBoundingClientRect();
        return [
            window.scrollX + annotationMaskBox.left,
            window.scrollY + annotationMaskBox.top,
            window.scrollX + annotationMaskBox.right,
            window.scrollY + annotationMaskBox.bottom,
        ];
    }

    get pdfPageDetail(): PdfPageDetail | null {
        const pdfPageNode = this.pdfPageNode;
        if (!pdfPageNode) {
            return null;
        }
        
        return {
            pageNumber: this.pdfPageNumber,
            width: parseFloat(pdfPageNode.getAttribute("data-viewport-width")!),
            height: parseFloat(pdfPageNode.getAttribute("data-viewport-height")!),
            scale: parseFloat(pdfPageNode.getAttribute("data-viewport-scale")!)
        };
    }
}