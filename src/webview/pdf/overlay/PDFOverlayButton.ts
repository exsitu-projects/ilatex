import { AbstractPDFOverlay } from "./AbstractPDFOverlay";


type PDFOverlayButtonClickCallback = (self: PDFOverlayButton, event: MouseEvent) => void;


export class PDFOverlayButton extends AbstractPDFOverlay {
    private message: string;
    private id: string;
    private onClickCallback: PDFOverlayButtonClickCallback;

    constructor(
        message: string,
        id: string,
        onClickCallback: PDFOverlayButtonClickCallback
    ) {
        super();
        
        this.message = message;
        this.id = id;
        this.onClickCallback = onClickCallback;

        this.prepareContainerNode();
    }

    protected get containerNodeTag(): string { return "button"; }

    private prepareContainerNode(): void {
        this.node.classList.add("button");
        this.node.setAttribute("id", this.id);
        this.node.textContent = this.message;

        this.node.addEventListener("click", event => this.onClickCallback(this, event));
    }
}