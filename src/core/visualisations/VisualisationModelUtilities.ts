import * as vscode from "vscode";
import { InteractiveLatexDocument } from "../InteractiveLatexDocument";
import { VisualisationEventLogEntryData } from "../logs/LogFileManager";

export class VisualisationModelUtilities {
    readonly mainSourceFileUri: vscode.Uri;
    readonly createWebviewSafeUri: (uri: vscode.Uri) => vscode.Uri;
    readonly logEvent: (logEntry: VisualisationEventLogEntryData) => void;

    private constructor(ilatex: InteractiveLatexDocument) {
        this.mainSourceFileUri = ilatex.mainSourceFileUri;
        this.createWebviewSafeUri = (uri: vscode.Uri) => ilatex.webviewManager.createWebviewSafeUri(uri);
        this.logEvent = (logEntry: VisualisationEventLogEntryData) => ilatex.logFileManager.logVisualisationEvent(logEntry);
    }

    static from(ilatexDocument: InteractiveLatexDocument): VisualisationModelUtilities {
        return new VisualisationModelUtilities(ilatexDocument);
    }
}
