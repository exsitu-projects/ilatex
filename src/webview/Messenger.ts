import { vscode } from "./VisualCodeStudioApi";
import { AbstractMessenger } from "../shared/messenger/AbstractMessenger";
import { CoreToWebviewMessageType, WebviewToCoreMessageType, WebviewToCoreMessage } from "../shared/messenger/messages";

export class Messenger extends AbstractMessenger<
    WebviewToCoreMessageType,
    CoreToWebviewMessageType
>{
    // The event is a DOM event object created by the webview
    // when it receives a message from the core of the extension
    // (through the webview VSCode API).
    // The actual content of the message sent by the core of the extension
    // is therefore located in the "data" property of this object.
    private readonly messageEventHandler = (event: any) => {
        this.handleMessage(event.data);
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