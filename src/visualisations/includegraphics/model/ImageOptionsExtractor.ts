import { EmptyASTValue, EMPTY_AST_VALUE } from "../../../core/ast/LatexParser";
import { ParameterAssignmentNode } from "../../../core/ast/nodes/ParameterAssignmentNode";
import { ParameterNode } from "../../../core/ast/nodes/ParameterNode";
import { SquareBracesParameterBlockNode } from "../../../core/ast/nodes/SquareBracesParameterBlockNode";
import { ASTSyncVisitorAdapter } from "../../../core/ast/visitors/adapters";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { BooleanParameter, LengthParameter, NumericParameter } from "../../../core/utils/latex-parameters";
import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { LatexLengthCustomSettings } from "../../../shared/latex-length/LatexLengthSettings";
import { ImageOptions, SupportedImageOptions, TrimParameter } from "./ImageOptions";

export class InvalidImageOptionError {}

export class ImageOptionsExtractor extends ASTSyncVisitorAdapter {
    private static readonly DEFAULT_LATEX_LENGTH_SETTINGS = {
        // Big points are the default unit for includegraphics (in graphicx package)
        defaultUnit: "bp",

        // Since the values read by this extractor will have to be converted to standard units (such as pixels),
        // option values that are set to lengths with non-convertible units must be rejected
        onlyAcceptConvertibleUnits: true
    };

    private latexLengthSettings: LatexLengthCustomSettings;
    readonly options: SupportedImageOptions;

    constructor(codeMapping: CodeMapping) {
        super();

        this.options = {};
        this.latexLengthSettings = {
            ...codeMapping.localLatexLengthSettings,
            ...ImageOptionsExtractor.DEFAULT_LATEX_LENGTH_SETTINGS
        };
    }

    visitParameterNode(node: ParameterNode): void {
        const parameter = node.value;
        if (parameter === "clip") {
            this.options.clip = new BooleanParameter(true, node);
        }

        if (parameter === "keepaspectratio") {
            this.options.keepAspectRatio = new BooleanParameter(true, node);
        }
    }

    visitParameterAssignmentNode(node: ParameterAssignmentNode): void {
        const key = node.key.name;
        const value = node.value.value;

        switch (key) {
            case "width":
                this.options.width = new LengthParameter(
                    LatexLength.from(value, this.latexLengthSettings),
                    node
                );
                break;
            
            case "height":
                this.options.height = new LengthParameter(
                    LatexLength.from(value, this.latexLengthSettings),
                    node
                );
                break;
            
            case "scale":
                this.options.scale = new NumericParameter(
                    parseFloat(value),
                    node
                );
                break;
            
            case "trim":
                const trimLengths = value
                    .split(/\s+/)
                    .map(lengthAsText => LatexLength.from(lengthAsText, this.latexLengthSettings));

                // Only accept the trim value if it is made of 4 valid lengths
                if (trimLengths.length !== 4) {
                    console.warn(`The 'trim' parameter of an includegraphics command is invalid: it contains ${trimLengths.length} values (instead of 4).`);
                    throw new InvalidImageOptionError();
                }

                this.options.trim = new TrimParameter({
                    left: trimLengths[0],
                    bottom: trimLengths[1],
                    right: trimLengths[2],
                    top: trimLengths[3]
                }, node);
                break;
            
            case "clip":
                this.options.clip = new BooleanParameter(
                    value.trim().toLowerCase() === "true",
                    node
                );
                break;
            
            case "keepaspectratio":
                this.options.clip = new BooleanParameter(
                    value.trim().toLowerCase() === "true",
                    node
                );
                break;
        }
    }

    static async extractImageOptionsFrom(
        optionsParameterBlockNode: SquareBracesParameterBlockNode | EmptyASTValue,
        codeMapping: CodeMapping
    ): Promise<ImageOptions> {
        if (optionsParameterBlockNode === EMPTY_AST_VALUE) {
            return new ImageOptions({});
        }

        const optionsExtractor = new ImageOptionsExtractor(codeMapping);
        optionsParameterBlockNode.syncVisitWith(optionsExtractor, 0);

        return new ImageOptions(optionsExtractor.options);
    }
}