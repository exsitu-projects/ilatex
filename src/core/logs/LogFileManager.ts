import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { InteractiveLatexDocument } from "../InteractiveLatexDocument";
import { LogEntry, LogEntrySource, PartialLogEntry } from "./LogEntry";
import { LogFile } from "./LogFile";
import { PathUtils } from "../utils/PathUtils";


type LogDataForSource<
    S extends LogEntrySource,
    T = PartialLogEntry & { source: S }
> = Omit<T, "source">;

export type CoreEventLogEntryData = LogDataForSource<LogEntrySource.CoreEvent>;
export type VisualisationEventLogEntryData = LogDataForSource<LogEntrySource.VisualisationEvent>;
export type UserEditEventLogEntryData = LogDataForSource<LogEntrySource.UserEditEvent>;
export type ErrorLogEntryData = LogDataForSource<LogEntrySource.Error>;


export class LogFileManager {
    private ilatexDocument: InteractiveLatexDocument;

    private localLogFile: LogFile | null; // null if local logging is disabled
    private centralisedLogFile: LogFile | null; // null if centralised logging is disabled

    constructor(ilatexDocument: InteractiveLatexDocument) {
        this.ilatexDocument = ilatexDocument;

        this.localLogFile = this.createLocalLogFileOrNull();
        this.centralisedLogFile = this.createCentralisedLogFileOrNull();
    }

    get localLogFilePath(): string {
        const mainSourceFilePath = this.ilatexDocument.mainSourceFileUri.path;
        const useHiddenFile = this.ilatexDocument.options.localLogFileType === "hidden";

        const directoryPath = path.dirname(mainSourceFilePath);
        const fileName = path.basename(mainSourceFilePath);

        const lastFileNameDotIndex = fileName.lastIndexOf(".");
        const regularLogFileName = fileName.substring(0, lastFileNameDotIndex >= 0 ? lastFileNameDotIndex : undefined);
        const logFileName = `${useHiddenFile ? "." : ""}${regularLogFileName}.ilatex-logs`;
        
        return path.join(directoryPath, logFileName);
    }

    get centralisedLogFilePath(): string {
        const mainSourceFilePath = this.ilatexDocument.mainSourceFileUri.path;
        const centralisedLoggingDirectoryPath = PathUtils.resolveLeadingTilde(this.ilatexDocument.options.centralisedLoggingDirectoryPath);

        // Use the first 48 characters of an hexadecimal hash of the path of the main source file,
        // so that the entire filename (with the extension) fits in less than 64 bytes.
        // Most file systems currently in use seem to handle 255-bytes long file names
        // (cf. https://en.wikipedia.org/wiki/Comparison_of_file_systems#Limits), so that length should be fine.
        // Regarding collisions, it is little likely to happen; but even if it does, it will not be a very big deal
        // (log entries will simply be logged in the "wrong" log file, but they would not be lost).
        const hashedMainSourceFilePath = crypto.createHash("sha1").update(mainSourceFilePath).digest("hex");
        const logFileName = `${hashedMainSourceFilePath.substr(0, 48)}.ilatex-logs`;
        
        return path.join(centralisedLoggingDirectoryPath, logFileName);        
    }

    private get managesAtLeastOneLogFile(): boolean {
        return this.localLogFile !== null
            || this.centralisedLogFile !== null;
    }

    private createLocalLogFileOrNull(): LogFile | null {
        if (!this.ilatexDocument.options.enableLocalLogging) {
            return null;
        }

        return new LogFile(
            this.localLogFilePath,
            this.ilatexDocument.mainSourceFileUri.path
        );
    }

    private createCentralisedLogFileOrNull(): LogFile | null {
        if (!this.ilatexDocument.options.enableCentralisedLogging) {
            return null;
        }

        
        
        // Ensure all the directories of the path to the directory
        // of the centralised logs exists, or create every missing one of them
        // If this step does not succeeds, display a warning message
        // and do not create any centralised log file (return null instead)
        const centralisedLogFilePath = this.centralisedLogFilePath;
        const centralisedLoggingDirectoryPath = path.dirname(centralisedLogFilePath);

        try {
            // mkdirSync does not throw an exception when all the directories of the path exist if the 'recursive' flag is set
            fs.mkdirSync(centralisedLoggingDirectoryPath, { recursive: true });
            
            return new LogFile(
                centralisedLogFilePath,
                this.ilatexDocument.mainSourceFileUri.path
            );   
        }
        catch (error) {
            vscode.window.showWarningMessage(`i-LaTeX could not create the directory for centralised log files (${centralisedLoggingDirectoryPath}). Please try with a different path or ask for help.`);
            return null;
        } 
    }

    private writeLogEntry(entry: LogEntry): void {
        this.localLogFile?.writeLogEntry(entry);
        this.centralisedLogFile?.writeLogEntry(entry);
    }

    log(entry: PartialLogEntry): void {
        if (!this.managesAtLeastOneLogFile) {
            return;
        }

        const fullEntry = {
            mainFileName: path.basename(this.ilatexDocument.mainSourceFileUri.path),
            activeFileName: path.basename(vscode.window.activeTextEditor?.document.uri.path ?? ""),
            timestamp: new Date().getTime(),

            ...entry
        };

        this.writeLogEntry(fullEntry);
    }

    logCoreEvent(entry: CoreEventLogEntryData): void {
        this.log({ source: LogEntrySource.CoreEvent, ...entry });
    }

    logVisualisationEvent(entry: VisualisationEventLogEntryData): void {
        this.log({ source: LogEntrySource.VisualisationEvent, ...entry });
    }

    logUserEditEvent(entry: UserEditEventLogEntryData): void {
        this.log({ source: LogEntrySource.UserEditEvent, ...entry });
    }

    logError(entry: ErrorLogEntryData): void {
        this.log({ source: LogEntrySource.Error, ...entry });
    }

    dispose(): void {
        this.localLogFile?.close();
        this.centralisedLogFile?.close();
    }
}