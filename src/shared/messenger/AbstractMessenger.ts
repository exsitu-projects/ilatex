import { MessageType, Message, MessagesOfType } from "./messages";

export type MessageHandler<T extends Message> = (messsage: T) => void;

export abstract class AbstractMessenger<
    SendableMessageType extends MessageType,
    ReceivableMessageType extends MessageType,
> {
    private messageHandlers: Map<
        ReceivableMessageType,
        MessageHandler<MessagesOfType<ReceivableMessageType>>
    >;

    constructor() {
        this.messageHandlers = new Map();
    }

    abstract startHandlingMessages(): void;

    abstract stopHandlingMessages(): void;

    abstract sendMessage(message: MessagesOfType<SendableMessageType>): void;

    protected handleMessage(message: MessagesOfType<ReceivableMessageType>): void {
        console.log("Received message:", message);

        if (!this.messageHandlers.has(message.type)) {
            console.error("There is no handler for messages of type:", message.type);
            return;
        }

        const handler = this.messageHandlers.get(message.type)!;
        handler(message);
    }

    setHandlerFor<T extends ReceivableMessageType>(type: T, handler: MessageHandler<MessagesOfType<T>>) {
        // TODO: find a way to avoid the cast below
        // It looks like MessagesOfType<T> is too generic—maybe because it could be a sub-union of messages?
        this.messageHandlers.set(type, handler as MessageHandler<Message>);
    }

    unsetHandlerFor<T extends ReceivableMessageType>(type: T) {
        this.messageHandlers.delete(type);
    }
}