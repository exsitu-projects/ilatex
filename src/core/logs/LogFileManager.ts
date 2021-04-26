import * as vscode from "vscode";
import * as path from "path";
import { InteractiveLatex } from "../InteractiveLatex";
import { LogEntry, LogEntrySource, PartialLogEntry } from "./LogEntry";
import { LogFile } from "./LogFile";


type LogDataForSource<
    S extends LogEntrySource,
    T = PartialLogEntry & { source: S }
> = Omit<T, "source">;

export type CoreEventLogEntryData = LogDataForSource<LogEntrySource.CoreEvent>;
export type VisualisationEventLogEntryData = LogDataForSource<LogEntrySource.VisualisationEvent>;
export type UserEditEventLogEntryData = LogDataForSource<LogEntrySource.UserEditEvent>;
export type ErrorLogEntryData = LogDataForSource<LogEntrySource.Error>;


export class LogFileManager {
    private ilatex: InteractiveLatex;

    private logFile: LogFile | null; // null if logging is disabled

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.logFile = this.ilatex.options.enableLogging
            ? new LogFile(
                this.ilatex.mainSourceFileUri.path,
                this.ilatex.options.logFileType === "hidden"
            )
            : null;
    }

    log(entry: PartialLogEntry): void {
        if (!this.logFile) {
            return;
        }

        const fullEntry = {
            mainFileName: path.basename(this.ilatex.mainSourceFileUri.path),
            activeFileName: path.basename(vscode.window.activeTextEditor?.document.uri.path ?? ""),
            timestamp: new Date().getTime(),

            ...entry
        };

        this.logFile.writeLogEntry(fullEntry);
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
        if (!this.logFile) {
            return;
        }

        this.logFile.close();
    }
}