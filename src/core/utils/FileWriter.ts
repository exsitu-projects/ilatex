import * as fs from "fs";

export const enum FileWriterMode {
    Erase = "Erase",
    Append = "Append",
}

export class FileWriter {
    readonly path: string;
    readonly mode: FileWriterMode;
    readonly writer: fs.WriteStream;

    constructor(path: string, mode: FileWriterMode) {
        this.path = path;
        this.mode = mode;

        this.writer = fs.createWriteStream(path, {
            flags: mode === FileWriterMode.Erase ? "w" : "a",
            emitClose: false
        });
    }

    write(data: string): void {
        this.writer.write(data);
    };

    close(): void {
        this.writer.end();
        this.writer.close();
    };
}
