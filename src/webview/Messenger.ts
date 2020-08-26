import { vscode } from "./VisualCodeStudioApi";
import { AbstractMessenger } from "../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessageType, WebviewToCoreMessageType, WebviewToCoreMessage } from "../shared/messenger/messages";

export class Messenger extends AbstractMessenger<
    WebviewToCoreMessageType,
    CoreToWebviewMessageType
>{
    private readonly messageEventHandler = (message: any) => {
        this.handleMessage(message);
    }; 
    
    constructor() {
        super();
    }

    startHandlingMessages(): void {
        window.addEventListener("message", this.messageEventHandler);
    }

    stopHandlingMessages(): void {
        window.removeEventListener("message", this.messageEventHandler);
    }

    sendMessage(message: WebviewToCoreMessage): void {
        vscode.postMessage(message);
    }

}