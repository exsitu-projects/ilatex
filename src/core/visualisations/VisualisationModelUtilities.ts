import * as vscode from "vscode";
import { InteractiveLatex } from "../InteractiveLaTeX";

export class VisualisationModelUtilities {
    readonly mainSourceFileUri: vscode.Uri;
    readonly createWebviewSafeUri: (uri: vscode.Uri) => vscode.Uri;

    private constructor(ilatex: InteractiveLatex) {
        this.mainSourceFileUri = ilatex.mainSourceFileUri;
        this.createWebviewSafeUri = (uri: vscode.Uri) => ilatex.webviewManager.createWebviewSafeUri(uri);
    }

    static from(ilatex: InteractiveLatex): VisualisationModelUtilities {
        return new VisualisationModelUtilities(ilatex);
    }
}
