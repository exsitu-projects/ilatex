import * as fs from "fs";
import * as path from "path";
import { LogEntry } from "./LogEntry";
import { FileWriter, FileWriterMode } from "../utils/FileWriter";

type AllLogEntryKeys = EveryPossibleKeysOf<LogEntry>;
type WriteableLogEntryKeys =
    AllLogEntryKeys;
    // Exclude<AllLogEntryKeys, "source">;

const logEntryFieldsToCsvColumnNames: Record<WriteableLogEntryKeys, string> = {
    source: "source",
    event: "event",
    timestamp: "timestamp",
    fileName: "filename",

    transitionalName: "transitional-name",
    transitionalUid: "transitional-uid",
    transitionalCodeMappingId: "transitional-code-mapping-id",

    editKind: "edit-kind",
    editSize: "edit-size"
};

const orderedCsvColumnNames: WriteableLogEntryKeys[] = [
    "source",
    "event",
    "timestamp",
    "fileName",
    "transitionalName",
    "transitionalUid",
    "transitionalCodeMappingId",
    "editKind",
    "editSize",
];

export class LogFile {
    private readonly mainSourceFilePath: string;
    private readonly path: string;
    private logFileWriter: FileWriter;

    constructor(
        logFilePath: string,
        mainSourceFilePath: string
    ) {
        this.path = logFilePath;
        this.mainSourceFilePath = mainSourceFilePath;

        // Note: the existence of the log file must be tested BEFORE creating the file writer,
        // as it will create the file if it does not exist yet!
        const logFileAlreadyExists = this.exists;
        console.log(
            this.exists
                ? `Existing log file detected (${this.path}).`
                : `No existing log file detected: a new file will be created (${this.path}).`
        );

        this.logFileWriter = new FileWriter(this.path, FileWriterMode.Append);

        // If this is a new log file, write the file header and the column names before anything else
        if (!logFileAlreadyExists) {
            this.writeFileHeader();
            this.writeColumnNames();
        }
    }

    get exists(): boolean {
        return fs.existsSync(this.path);
    }

    // Write a header with the current date and time and the path to this log file
    // Note: this is not valid CSV syntax: it should only be used at the top of the file
    // so it can be easily removed to make the file CSV-parse-able!
    private writeFileHeader(): void {
        this.logFileWriter.write(`# This is a log file created by the iLaTeX editor\n`);
        this.logFileWriter.write(`# main source file: ${this.mainSourceFilePath}\n`);
        this.logFileWriter.write(`# created on: ${new Date().toUTCString()} (${Date.now()})\n`);
    }

    // Write the name of every column in the order specified by orderedCsvColumnNames
    private writeColumnNames(): void {
        const columnNamesAsString = orderedCsvColumnNames
            .map(field => `"${logEntryFieldsToCsvColumnNames[field]}"`)
            .join(",")
            .concat("\n");
        
        this.logFileWriter.write(columnNamesAsString);
    }

    writeLogEntry(entry: LogEntry): void {
        // Write the value of every field in the order specified by orderedCsvColumnNames
        // Every missing field will produce an empty string in the written entry
        const logEntryAsString = orderedCsvColumnNames
            .map(columnName => LogFile.convertLogEntryFieldValueToString(entry, columnName))
            .join(",")
            .concat("\n");

        this.logFileWriter.write(logEntryAsString);
    }

    close(): void {
        this.logFileWriter.close();
    }

    private static convertLogEntryFieldValueToString(entry: LogEntry, key: string): string {
        if (! (key in entry)) {
            return "";
        }

        // The cast below seems required depsite the test with the "in" operator above
        const fieldValue = entry[key as keyof LogEntry];

        switch (typeof fieldValue) {
            case "number":
            case "bigint":
                return `${fieldValue}`;
                
            case "boolean":
                return fieldValue ? "true" : "false";

            case "string":
                return `"${fieldValue}"`;

            default:
                console.warn(`A log entry field that is neither a number, a boolean or a string is being written to the log file (key = ${key}, value = ${fieldValue}).`);
                return `"${fieldValue}"`;
        }
    }
}
