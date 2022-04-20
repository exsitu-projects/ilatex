import { RawSourceFileRange } from "../source-files/types";

/** Type of a unique transitional model identifier. */
export type TransitionalModelUID = number;

/** Type of the content produced by models and expected by views (currently, a HTML string). */
export type TransitionalContent = string;

/** Type of the metadata of a transitional, i.e. general information about the current state and context of the model. */
export interface TransitionalMetadata {
    /** The name of the transitional. It must be the same in the model and in the view. */
    name: string;

    /** The current UID of the model. */
    uid: TransitionalModelUID;

    /** The code mapping ID of the transitional. */
    codeMappingId: number;

    /** The absolute path to the file that contains the code of the transitional. */
    absoluteFilePath: string;

    /** The name of the file that contains the code of the transitional. */
    fileName: string;

    /** The range of the code of the transitional in the source file that contains it. */
    codeRange: RawSourceFileRange;

    /** A flag set to `true` if the transitional is available (i.e., if it can be used by the user). */
    available: boolean;
};