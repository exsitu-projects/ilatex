import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface FileRecord {
    absolutePath: string;
    filename: string;
    content: string;
}

export class FileReader {
    // Absolute path to the root directory of this extension
    static readonly EXTENSION_ROOT_PATH = vscode.extensions
        .getExtension("exsitu.interactive-latex")!
        .extensionPath;

    static getFilename(path: string): string {
        const lastSlashIndex = path.lastIndexOf("/");
        return path.substr(lastSlashIndex + 1);
    }

    // Create a file record for a file of this extension
    // The path to the file must be relative to the root directory of the extension
    static readExtensionFile(relativePath: string): FileRecord {
        // Absolute path of the file
        const absolutePath = path.resolve(FileReader.EXTENSION_ROOT_PATH, relativePath);

        // Name of the file
        const lastSlashIndex = relativePath.lastIndexOf("/");
        const filename = relativePath.substr(lastSlashIndex + 1);

        // Content of the file
        const contentFileBuffer = fs.readFileSync(absolutePath);

        return {
            absolutePath: absolutePath,
            filename: filename,
            content: contentFileBuffer.toString()
        };
    }

    static readExtensionFiles(relativePaths: string[]): FileRecord[] {
        return relativePaths.map(path => FileReader.readExtensionFile(path));
    }
}