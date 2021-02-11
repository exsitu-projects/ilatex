import { EmptyASTValue } from "../../../core/ast/LatexParser";
import { ParameterAssignmentNode } from "../../../core/ast/nodes/ParameterAssignmentNode";
import { ParameterNode } from "../../../core/ast/nodes/ParameterNode";
import { SquareBracesParameterBlockNode } from "../../../core/ast/nodes/SquareBracesParameterBlockNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { BooleanParameter, LengthParameter, LatexParameter, NumericParameter, RawValueOf, RAW_LATEX_PARAMETER_DIMENSION_UNIT } from "../../../core/utils/latex-parameters";
import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { ImageOptionsExtractor } from "./ImageOptionsExtractor";

/** A constant array of all the option keys available in ImageOptions and other related types. */
export const SUPPORTED_IMAGE_OPTIONS_KEYS = [
    "width",
    "height",
    "scale",
    "trim",
    "clip",
    "keepAspectRatio",
] as const;

// Helper types
type SupportedImageOptionKeys = typeof SUPPORTED_IMAGE_OPTIONS_KEYS[number];
type ObjectWithSupportedImageOptionKeys = { [K in SupportedImageOptionKeys]: any };


// Custom LaTeX parameter for the trim option

interface TrimValue {
    readonly left: LatexLength;
    readonly bottom: LatexLength;
    readonly right: LatexLength;
    readonly top: LatexLength;
};

type RawTrimValue = { [K in keyof TrimValue]: number; };

export class TrimParameter extends LatexParameter<TrimValue, RawTrimValue, ParameterAssignmentNode> {
    get rawValue(): RawTrimValue {
        return {
            left: this.value.left[RAW_LATEX_PARAMETER_DIMENSION_UNIT],
            bottom: this.value.bottom[RAW_LATEX_PARAMETER_DIMENSION_UNIT],
            right: this.value.right[RAW_LATEX_PARAMETER_DIMENSION_UNIT],
            top: this.value.top[RAW_LATEX_PARAMETER_DIMENSION_UNIT]
        };
    }
};



// Helper types

export interface SupportedImageOptions extends Partial<ObjectWithSupportedImageOptionKeys> {
    width?: LengthParameter<ParameterAssignmentNode>;
    height?: LengthParameter<ParameterAssignmentNode>;
    scale?: NumericParameter<ParameterAssignmentNode>;
    trim?: TrimParameter;
    clip?: BooleanParameter;
    keepAspectRatio?: BooleanParameter;
}

export type RawImageOptions = Partial<{ [K in SupportedImageOptionKeys]: RawValueOf<NonNullable<SupportedImageOptions[K]>> }>;



export class ImageOptions implements SupportedImageOptions {
    readonly width?: LengthParameter<ParameterAssignmentNode>;
    readonly height?: LengthParameter<ParameterAssignmentNode>;
    readonly scale?: NumericParameter<ParameterAssignmentNode>;
    readonly trim?: TrimParameter;
    readonly clip?: BooleanParameter;
    readonly keepAspectRatio?: BooleanParameter;

    constructor(
        options: SupportedImageOptions
    ) {
        const writeableSelf = this as Required<Writeable<ImageOptions>>;
        for (let key of ImageOptions.optionKeysOf(options)) {
            writeableSelf[key] = options[key] as any;
        }

        // if (options.width) { this.width = options.width; }
        // if (options.height) { this.height = options.height; }
        // if (options.scale) { this.scale = options.scale; }
        // if (options.trim) { this.trim = options.trim; }
        // if (options.clip) { this.clip = options.clip; }
        // if (options.keepAspectRatio) { this.keepAspectRatio = options.keepAspectRatio; }
    }

    get raw(): RawImageOptions {
        return ImageOptions.optionKeysOf(this)
            .reduce((accumulatedOptions, key) => {
                const option = this[key]!;
                return {
                    ...accumulatedOptions,
                    key: option.rawValue
                };
            }, {});
    }

    static optionKeysOf(object: object): SupportedImageOptionKeys[] {
        const objectKeys = Object.keys(object);
        return SUPPORTED_IMAGE_OPTIONS_KEYS
            .filter(key => objectKeys.includes(key));
    }

    static async from(
        optionsParameterBlockNode: SquareBracesParameterBlockNode | EmptyASTValue,
        codeMapping: CodeMapping
    ): Promise<ImageOptions> {
        return ImageOptionsExtractor.extractImageOptionsFrom(
            optionsParameterBlockNode,
            codeMapping
        );
    }
}
