import * as vscode from "vscode";
import { InteractiveLatexDocument } from "../InteractiveLatexDocument";
import { TransitionalEventLogEntryData } from "../logs/LogFileManager";

export class TransitionalModelUtilities {
    readonly mainSourceFileUri: vscode.Uri;
    readonly createWebviewSafeUri: (uri: vscode.Uri) => vscode.Uri;
    readonly logEvent: (logEntry: TransitionalEventLogEntryData) => void;

    private constructor(ilatex: InteractiveLatexDocument) {
        this.mainSourceFileUri = ilatex.mainSourceFileUri;
        this.createWebviewSafeUri = (uri: vscode.Uri) => ilatex.webviewManager.createWebviewSafeUri(uri);
        this.logEvent = (logEntry: TransitionalEventLogEntryData) => ilatex.logFileManager.logTransitionalEvent(logEntry);
    }

    static from(ilatexDocument: InteractiveLatexDocument): TransitionalModelUtilities {
        return new TransitionalModelUtilities(ilatexDocument);
    }
}
