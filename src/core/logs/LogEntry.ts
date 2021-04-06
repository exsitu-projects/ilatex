import { RawSourceFileRange } from "../../shared/source-files/types";
import { SourceFileChangeKind } from "../source-files/SourceFileChange";

export const enum LogEntrySource {
    CoreEvent = "core",
    VisualisationEvent = "visualisation",
    UserEditEvent = "user-edit",
    Error = "error"
}

export type PartialLogEntry = {
    source: LogEntrySource.CoreEvent;
    event: string;
} | {
    source: LogEntrySource.VisualisationEvent;
    event: string;
    fileName: string;

    visualisationUid: number;
    visualisationCodeMappingId: number;
    visualisationName: string;
} | {
    source: LogEntrySource.UserEditEvent;
    event: string;
    fileName: string;

    // Details about the visualisation associated with the piece of code affected by the edit 
    visualisationUid: number;
    visualisationCodeMappingId: number;
    visualisationName: number;

    // Details about the edit operation
    editKind: SourceFileChangeKind;
    editRange: RawSourceFileRange;
} | {
    source: LogEntrySource.Error;
    event: string;
};

export type LogEntry = {
    timestamp: number;
} & PartialLogEntry;