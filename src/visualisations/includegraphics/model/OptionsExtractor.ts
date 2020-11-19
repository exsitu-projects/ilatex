import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { LatexASTVisitorAdapter } from "../../../core/ast/visitors/LatexASTVisitorAdapter";
import { ASTParameterNode, ASTParameterAssignmentNode } from "../../../core/ast/LatexASTNode";
import { LatexLengthCustomSettings } from "../../../shared/latex-length/LatexLengthSettings";
import { CodeMapping } from "../../../core/mappings/CodeMapping";

export interface Options {
    width?: LatexLength;
    height?: LatexLength;
    scale?: number;
    trim?: LatexLength[];
    clip?: boolean;
    keepaspectratio?: boolean;
}

export class OptionsExtractor extends LatexASTVisitorAdapter {
    private static readonly LATEX_LENGTH_SETTINGS = {
        // Big points are the default unit for includegraphics (in graphicx package)
        defaultUnit: "bp"
    };

    readonly options: Options;
    private latexLengthSettings: LatexLengthCustomSettings;

    constructor(mapping: CodeMapping) {
        super();

        this.options = {};
        this.latexLengthSettings = {
            ...mapping.contextualLatexLengthSettings,
            ...OptionsExtractor.LATEX_LENGTH_SETTINGS
        };
    }

    protected visitParameterNode(node: ASTParameterNode): void {
        const parameter = node.value;
        if (parameter === "clip") {
            this.options.clip = true;
        }

        if (parameter === "keepaspectratio") {
            this.options.keepaspectratio = true;
        }
    }

    protected visitParameterAssignmentNode(node: ASTParameterAssignmentNode): void {
        const key = node.value.key.value.trim();
        const value = node.value.value.value.trim();

        if (key === "width") {
            this.options.width = LatexLength.from(value, this.latexLengthSettings);
        }
        else if (key === "height") {
            this.options.height = LatexLength.from(value, this.latexLengthSettings);
        }
        else if (key === "scale") {
            this.options.scale = parseFloat(value);
        }
        else if (key === "trim") {
            this.options.trim = value
                .split(/\s+/)
                .map(lengthAsText => LatexLength.from(lengthAsText, this.latexLengthSettings));
        }
        else if (key === "clip") {
            this.options.clip = value.trim().toLowerCase() === "true";
        }
        else if (key === "keepaspectratio") {
            this.options.clip = value.trim().toLowerCase() === "true";
        }
    }
}