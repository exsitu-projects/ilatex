import { PDFOverlayNotification } from "./PDFOverlayNotification";

export class PDFOverlayManager {
    private notificationContainerNode: HTMLElement;

    constructor() {
        this.notificationContainerNode = this.createNotificationContainer();
        this.init();
    }

    private init(): void {
        document.body.prepend(this.notificationContainerNode);
    }

    private createNotificationContainer(): HTMLElement {
        const containerNode = document.createElement("div");
        containerNode.setAttribute("id", "notification-container");

        return containerNode;
    }

    displayNotification(notification: PDFOverlayNotification): void {
        notification.displayIn(this.notificationContainerNode);
    }
}