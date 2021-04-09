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

    // Details about the edit operation
    editKind: string;
    editSize: number;

    // Optional details about the visualisation associated to
    // the piece of code affected by the edit (if any)
    visualisationUid?: number;
    visualisationCodeMappingId?: number;
    visualisationName?: number;
} | {
    source: LogEntrySource.Error;
    event: string;

    // Optional file related to the error (if any)
    fileName?: string;

    // Optional details about the visualisation related to the error (if any)
    visualisationUid?: number;
    visualisationCodeMappingId?: number;
    visualisationName?: number;
};

export type LogEntry = {
    timestamp: number;
} & PartialLogEntry;