import * as vscode from "vscode";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { VisualisationEventLogEntryData } from "../logs/LogFileManager";

export class VisualisationModelUtilities {
    readonly mainSourceFileUri: vscode.Uri;
    readonly createWebviewSafeUri: (uri: vscode.Uri) => vscode.Uri;
    readonly logEvent: (logEntry: VisualisationEventLogEntryData) => void;

    private constructor(ilatex: InteractiveLatex) {
        this.mainSourceFileUri = ilatex.mainSourceFileUri;
        this.createWebviewSafeUri = (uri: vscode.Uri) => ilatex.webviewManager.createWebviewSafeUri(uri);
        this.logEvent = (logEntry: VisualisationEventLogEntryData) => ilatex.logFileManager.logVisualisationEvent(logEntry);
    }

    static from(ilatex: InteractiveLatex): VisualisationModelUtilities {
        return new VisualisationModelUtilities(ilatex);
    }
}
