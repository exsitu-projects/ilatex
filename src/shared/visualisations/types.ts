import { RawSourceFileRange } from "../source-files/types";

/** Type of a unique visualisation model identifier. */
export type VisualisationModelUID = number;

/** Type of the content produced by visualisation models and expected by visualisation views (currently a HTML string). */
export type VisualisationContent = string;

/** Type of the metadata of a visualisation model, i.e. general information about its current state. */
export interface VisualisationMetadata {
    /** The name of the visualisation. It must be the same in the model and in the view. */
    name: string;

    /** The current UID of the model. */
    uid: VisualisationModelUID;

    /** The ID of the code mapping of the visualisation. */
    codeMappingId: number;

    /** The absolute path to the file that contains the visualisable code. */
    absoluteFilePath: string;

    /** The name of the file that contains the visualisable code. */
    fileName: string;

    /** The range of the visualisable code in the source file that contains it. */
    codeRange: RawSourceFileRange;

    /** A flag set to `true` if the visualisation can be used by the user. */
    available: boolean;
};