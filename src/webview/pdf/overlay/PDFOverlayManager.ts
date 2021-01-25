import { PDFOverlayButton } from "./PDFOverlayButton";
import { PDFOverlayNotification } from "./PDFOverlayNotification";

export class PDFOverlayManager {
    private notificationContainerNode: HTMLElement;
    private actionButtonContainerNode: HTMLElement;

    constructor() {
        this.notificationContainerNode = this.createNotificationContainer();
        this.actionButtonContainerNode = this.createActionButtonContainer();

        this.init();
    }

    private init(): void {
        document.body.prepend(this.notificationContainerNode);
        document.body.prepend(this.actionButtonContainerNode);
    }

    private createActionButtonContainer(): HTMLElement {
        const containerNode = document.createElement("div");
        containerNode.setAttribute("id", "action-button-container");

        return containerNode;
    }

    private createNotificationContainer(): HTMLElement {
        const containerNode = document.createElement("div");
        containerNode.setAttribute("id", "notification-container");

        return containerNode;
    }

    displayNotification(notification: PDFOverlayNotification): void {
        notification.displayIn(this.notificationContainerNode);
    }

    displayActionButton(button: PDFOverlayButton): void {
        button.displayIn(this.actionButtonContainerNode);
    }
}