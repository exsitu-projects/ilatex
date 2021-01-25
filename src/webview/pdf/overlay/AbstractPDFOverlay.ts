export abstract class AbstractPDFOverlay {
    protected node: HTMLElement;
    protected isDisplayed: boolean;
    private displayDuration: number | null;

    private hideNotificationTimeoutHandle: number | null;

    constructor(displayDuration?: number) {
        this.node = this.createContainerNode();
        this.displayDuration = displayDuration ?? null;

        this.isDisplayed = false;
        this.hideNotificationTimeoutHandle = null;
    }

    protected get containerNodeTag(): string { return "div"; }

    private get hasDisplayDuration(): boolean {
        return this.displayDuration !== null;
    }
    
    protected createContainerNode(): HTMLElement {
        const containerNode = document.createElement(this.containerNodeTag);
        containerNode.classList.add("pdf-overlay");

        return containerNode;        
    }

    protected onBeforeDisplay(): void {
        // The notification node must have zero opacity when it is displayed
        // to enable the CSS fade-in animation to work properly
        this.node.style.opacity = "0";
    }

    protected onAfterDisplay(): void {
        this.isDisplayed = true;
        this.node.style.opacity = "1";

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