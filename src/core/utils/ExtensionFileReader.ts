import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// Interface of an extension file object,
// i.e. what is returned by ExtensionFileReader when it reads a file.
export interface ExtensionFile {
    relativePath: string;
    absolutePath: string;
    filename: string;
    content: string;
}

export class ExtensionFileReader {
    // Absolute path to the root directory of this extension.
    private static readonly EXTENSION_ROOT_PATH = vscode.extensions
        .getExtension("exsitu.ilatex")!
        .extensionPath;

    // Resolve a relative path rooted in the root directory of this VSC extension.
    static resolvePathFromExtensionRoot(relativePath: string): string {
        return path.resolve(ExtensionFileReader.EXTENSION_ROOT_PATH, relativePath);
    }

    // Create an extension file object from a file of this VSC extension.
    // The path to the file must be relative to the root directory of the extension;
    // it will be resolved by resolvePathFromExtensionRoot method.
    static readExtensionFile(relativePath: string): ExtensionFile {
        const absolutePath = ExtensionFileReader.resolvePathFromExtensionRoot(relativePath);
        const contentFileBuffer = fs.readFileSync(absolutePath);
        const filename = path.basename(relativePath);

        return {
            relativePath: relativePath,
            absolutePath: absolutePath,
            filename: filename,
            content: contentFileBuffer.toString()
        };
    }

    // Create an extension file object for each relative path of the given array-like.
    // See readExtensionFile method for details.
    static readExtensionFiles(relativePaths: string[]): ExtensionFile[] {
        return relativePaths.map(path =>
            ExtensionFileReader.readExtensionFile(path)
        );
    }
}