export const enum PDFOverlayNotificationType {
    Loading = "Loading"
}

export class PDFOverlayNotification {
    private type: PDFOverlayNotificationType;
    private message: string;
    private displayDuration: number | null;

    private node: HTMLElement;
    private isDisplayed: boolean;
    private hideNotificationTimeoutHandle: number | null;

    constructor(
        type: PDFOverlayNotificationType,
        message: string,
        displayDuration?: number
    ) {
        this.type = type;
        this.message = message;
        this.displayDuration = displayDuration ?? null;

        this.node = this.createContainer();
        this.init();

        this.isDisplayed = false;
        this.hideNotificationTimeoutHandle = null;
    }

    private get typeAsAttributeValue(): string {
        return this.type.toLowerCase();
    }

    private get hasDisplayDuration(): boolean {
        return this.displayDuration !== null;
    }

    protected init(): void {
        this.node.append(
            this.createMessage()
        );
    }

    private createContainer(): HTMLElement {
        const containerNode = document.createElement("div");
        containerNode.classList.add("notification");
        containerNode.setAttribute("data-notification-type", this.typeAsAttributeValue);

        return containerNode;        
    }

    protected createMessage(): HTMLElement {
        const messageNode = document.createElement("p");
        messageNode.classList.add("message");
        messageNode.textContent = this.message;

        return messageNode; 
    }

    protected onBeforeDisplay(): void {}

    protected onAfterDisplay(): void {
        this.isDisplayed = true;

        if (this.hasDisplayDuration) {
            this.hideNotificationTimeoutHandle = window.setTimeout(
                () => { this.hide(); },
                this.displayDuration!
            );
        }
    }

    protected onBeforeHide(): void {
        this.isDisplayed = false;

        if (this.hasDisplayDuration) {
            window.clearTimeout(this.hideNotificationTimeoutHandle!);
            this.hideNotificationTimeoutHandle = null;
        }       
    }

    protected onAfterHide(): void {}

    displayIn(container: HTMLElement): void {
        if (this.isDisplayed) {
            return;
        }

        this.onBeforeDisplay();
        container.append(this.node);
        this.onAfterDisplay();
    }

    hide(): void {
        if (!this.isDisplayed) {
            return;
        }

        this.onBeforeHide();
        this.node.remove();
        this.onAfterHide();
    }
}