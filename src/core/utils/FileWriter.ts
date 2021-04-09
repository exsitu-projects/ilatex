import * as fs from "fs";

export const enum FileWriterMode {
    Erase = "Erase",
    Append = "Append",
}

export class FileWriter {
    readonly path: string;
    readonly mode: FileWriterMode;
    readonly writer: fs.WriteStream;

    private isClosed: boolean;

    constructor(path: string, mode: FileWriterMode) {
        this.path = path;
        this.mode = mode;

        this.writer = fs.createWriteStream(path, {
            flags: mode === FileWriterMode.Erase ? "w" : "a",
            emitClose: false
        });

        this.isClosed = false;
    }

    write(data: string): void {
        if (this.isClosed) {
            return;
        }
        
        this.writer.write(data);
    };

    close(): void {
        if (this.isClosed) {
            return;
        }

        this.writer.end();
        this.writer.close();

        this.isClosed = true;
    };
}
