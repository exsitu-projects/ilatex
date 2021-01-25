import { AbstractPDFOverlay } from "./AbstractPDFOverlay";

export const enum PDFOverlayNotificationType {
    Loading = "Loading"
}

export class PDFOverlayNotification extends AbstractPDFOverlay {
    private type: PDFOverlayNotificationType;
    private message: string;

    constructor(
        type: PDFOverlayNotificationType,
        message: string,
        displayDuration?: number
    ) {
        super(displayDuration);
        
        this.type = type;
        this.message = message;

        this.prepareContainerNode();
    }

    private get typeAsAttributeValue(): string {
        return this.type.toLowerCase();
    }

    private createMessage(): HTMLElement {
        const messageNode = document.createElement("p");
        messageNode.classList.add("message");
        messageNode.textContent = this.message;

        return messageNode; 
    }

    private prepareContainerNode(): void {
        this.node.classList.add("notification");
        this.node.setAttribute("data-notification-type", this.typeAsAttributeValue);
        this.node.append(this.createMessage());
    }
}