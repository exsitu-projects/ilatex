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

    private logEntries: LogEntry[];
    private logFile: LogFile;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.logEntries = [];
        this.logFile = new LogFile(this.ilatex.mainSourceFileUri.path);
    }

    log(entry: PartialLogEntry): void {
        const fullEntry = {
            mainFileName: path.basename(this.ilatex.mainSourceFileUri.path),
            activeFileName: path.basename(vscode.window.activeTextEditor?.document.uri.path ?? ""),
            timestamp: Date.now(),

            ...entry
        };

        this.logEntries.push(fullEntry);
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
        this.logFile.close();
    }
}