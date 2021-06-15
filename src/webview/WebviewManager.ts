import { CoreToWebviewMessageType, UpdateGlobalOptionsMessage } from "../shared/messenger/messages";
import { Messenger } from "./Messenger";
import { PDFManager } from "./pdf/PDFManager";
import { VisualisationViewManager } from "./visualisations/VisualisationViewManager";

export class WebviewManager {
    private messenger: Messenger;
    private pdfManager: PDFManager;
    private visualisationViewManager: VisualisationViewManager;

    constructor() {
        this.messenger = new Messenger();
        this.pdfManager = new PDFManager(this.messenger);
        this.visualisationViewManager = new VisualisationViewManager(this.messenger);

        this.configureWebview();

        this.startHandlingWebviewMessages();
        this.messenger.startHandlingMessages();
    }

    private configureWebview(): void {
        // Disable the contextual menu added to webview in VS Code 1.57
        document.body.addEventListener("contextmenu", event => {
            event.preventDefault();
        });
    }

    private updateGlobalOptions(newGlobalOptions: UpdateGlobalOptionsMessage["options"]): void {
        // Globally enable or disable visualisations
        this.visualisationViewManager.setVisualisationsGloballyEnabled(newGlobalOptions.enableVisualisations);
    }

    private startHandlingWebviewMessages(): void {
        this.messenger.setHandlerFor(
            CoreToWebviewMessageType.UpdateGlobalOptions,
            async (message: UpdateGlobalOptionsMessage) => {
                this.updateGlobalOptions(message.options);
            }
        );
    }
}