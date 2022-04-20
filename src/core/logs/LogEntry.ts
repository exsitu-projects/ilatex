export const enum LogEntrySource {
    CoreEvent = "core",
    TransitionalEvent = "transitional",
    UserEditEvent = "user-edit",
    Error = "error"
}

export type PartialLogEntry = {
    source: LogEntrySource.CoreEvent;
    event: string;
} | {
    source: LogEntrySource.TransitionalEvent;
    event: string;
    fileName: string;

    transitionalUid: number;
    transitionalCodeMappingId: number;
    transitionalName: string;
} | {
    source: LogEntrySource.UserEditEvent;
    event: string;
    fileName: string;

    // Details about the edit operation
    editKind: string;
    editSize: number;

    // Optional details about the transitional associated to
    // the piece of code affected by the edit (if any)
    transitionalUid?: number;
    transitionalCodeMappingId?: number;
    transitionalName?: number;
} | {
    source: LogEntrySource.Error;
    event: string;

    // Optional file related to the error (if any)
    fileName?: string;

    // Optional details about the transitional related to the error (if any)
    transitionalUid?: number;
    transitionalCodeMappingId?: number;
    transitionalName?: number;
};

export type LogEntry = {
    timestamp: number;
} & PartialLogEntry;