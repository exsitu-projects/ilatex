import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { VisualisationModelFactory, VisualisationModel, VisualisationModelUtilities } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTCommandNode, ASTNodeType, ASTParameterListNode, ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { Options, OptionsExtractor } from "./OptionsExtractor";
import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { CodeMapping } from "../../../core/mappings/CodeMapping";


// TODO: avoid copying this type by hand...
interface RawViewOptions {
    width?: number;
    height?: number;
    scale?: number;
    trim?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }
    clip?: boolean;
}


class IncludegraphicsModel extends AbstractVisualisationModel<ASTCommandNode> {
    static readonly visualisationName = "includegraphics";
    readonly visualisationName = IncludegraphicsModel.visualisationName;

    private hasOptionsNode: boolean;
    private optionsNode: ASTParameterListNode | null;
    private pathNode: ASTParameterNode;

    private optionsStartPosition: vscode.Position;
    private optionsEndPosition: vscode.Position;

    private imagePath: string;
    private options: Options;

    constructor(node: ASTCommandNode, mapping: CodeMapping, utilities: VisualisationModelUtilities) {
        super(node, mapping, utilities);

        this.hasOptionsNode = this.astNode.value.parameters[0].length === 1;
        this.optionsNode = this.hasOptionsNode
                         ? this.astNode.value.parameters[0][0] as ASTParameterListNode
                         : null;
        this.pathNode = this.astNode.value.parameters[1][0] as ASTParameterNode;
        
        // Pre-compute values required to determine where to insert/replace command options
        const optionsStart = this.hasOptionsNode
                           ? this.optionsNode!.start
                           : this.astNode.value.nameEnd;
        const optionsEnd = this.hasOptionsNode
                         ? this.optionsNode!.end
                         : this.astNode.value.nameEnd;

        this.optionsStartPosition = new vscode.Position(optionsStart.line - 1, optionsStart.column - 1);
        this.optionsEndPosition = new vscode.Position(optionsEnd.line - 1, optionsEnd.column - 1);
        
        this.imagePath = this.extractImagePathFromASTNode();
        this.options = this.extractOptionsFromASTNode();
    }

    // Try to return the first absolute image path which point to an actual file
    // using all the paths specified in the code mapping context
    // plus the path to the directory containing the main source file last
    // (which is the default directory used by graphicx's includegraphics?).
    // If neither of them work, return null.
    get absoluteImagePath(): string | null {
        const imageDirectoryRelativePaths = new Set(this.codeMapping.context.graphicsPaths);
        imageDirectoryRelativePaths.add(".");

        for (let imageDirectoryRelativePath of imageDirectoryRelativePaths) {
            // All the paths are relative to the the main source file's directory...?
            const absoluteImagePath = path.resolve(
                path.dirname(this.utilities.mainSourceFileUri.path),
                imageDirectoryRelativePath,
                this.imagePath
            );
            
            if (fs.existsSync(absoluteImagePath)) {
                return absoluteImagePath;
            }
        }

        return null;
    }

    private extractImagePathFromASTNode(): string {
        return this.pathNode.value;
    }

    private extractOptionsFromASTNode(): Options {
        if (!this.hasOptionsNode) {
            return {};
        }

        const optionsReader = new OptionsExtractor(this.codeMapping);
        this.optionsNode!.visitWith(optionsReader);

        return optionsReader.options;
    }

    protected createContentAttributes(): Record<string, string> {
        const contentAttributes: Record<string, string> = {
            ...super.createContentAttributes(),

            // Add the path of the image
            "data-img-path": this.imagePath
        };

        // For each existing option, add an attribute
        // TODO: handle length conversion failures
        if (this.options.width !== undefined) {
            contentAttributes["data-opt-width"] = this.options.width.px.toString();
        }

        if (this.options.height !== undefined) {
            contentAttributes["data-opt-height"] = this.options.height.px.toString();
        }

        if (this.options.scale !== undefined) {
            contentAttributes["data-opt-scale"] = this.options.scale.toString();
        }

        if (this.options.trim !== undefined) {
            contentAttributes["data-opt-trim-left"] = this.options.trim.left.px.toString();
            contentAttributes["data-opt-trim-bottom"] = this.options.trim.bottom.px.toString();
            contentAttributes["data-opt-trim-right"] = this.options.trim.right.px.toString();
            contentAttributes["data-opt-trim-top"] = this.options.trim.top.px.toString();
        }

        if (this.options.clip !== undefined) {
            contentAttributes["data-opt-clip"] = this.options.clip ? "true" : "false";
        }

        return contentAttributes;
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        const self = this;

        return [
            ...super.createNotificationHandlerSpecifications(),

            {
                title: "set-options",
                handler: async payload => {
                    const rawOptions = payload.newOptions as RawViewOptions;
                    const updatedOptions = this.createUpdatedOptionsFromRawViewOptions(rawOptions);
                    
                    await this.setOptions(updatedOptions);
                }
            }
        ];
    }

    private createUpdatedOptionsFromRawViewOptions(rawOptions: RawViewOptions): Options {
        const self = this;

        // For the moment, there is no need to reuse the current options (only the current length units)
        // We therefore start with an empty options object
        const updatedOptions: Options = {};

        // Either reuse the unit/suffix/settings of the current length option or create a new one
        function createNewLengthWithOldUnitOrInPx(valueInPx: number, currentLengthOption: LatexLength | undefined): LatexLength {
            return currentLengthOption
                ? currentLengthOption.withValue(valueInPx, "px")
                : new LatexLength(valueInPx, "px", "", self.codeMapping.contextualLatexLengthSettings);
        }

        if (rawOptions.width) {
            updatedOptions.width = createNewLengthWithOldUnitOrInPx(rawOptions.width, this.options.width);
        }
        if (rawOptions.height) {
            updatedOptions.height = createNewLengthWithOldUnitOrInPx(rawOptions.height, this.options.height);
        }
        if (rawOptions.scale) {
            updatedOptions.scale = rawOptions.scale;
        }
        if (rawOptions.clip) {
            updatedOptions.clip = rawOptions.clip;
        }
        if (rawOptions.trim) {
            updatedOptions.trim = {
                left: createNewLengthWithOldUnitOrInPx(rawOptions.trim.left, this.options.trim?.left),
                bottom: createNewLengthWithOldUnitOrInPx(rawOptions.trim.bottom, this.options.trim?.bottom),
                right: createNewLengthWithOldUnitOrInPx(rawOptions.trim.right, this.options.trim?.right),
                top: createNewLengthWithOldUnitOrInPx(rawOptions.trim.top, this.options.trim?.top),
            };
        }

        return updatedOptions;
    }

    private async setOptions(newOptions: Options): Promise<void> {
        const editor = await this.codeMapping.sourceFile.getOrDisplayInEditor();

        // Transform options as optional key-value parameters for the includegraphics command
        const allOptionsAsStrings = [];

        if (newOptions.width) { allOptionsAsStrings.push(`width=${newOptions.width.toString()}`); }
        if (newOptions.height) { allOptionsAsStrings.push(`height=${newOptions.height.toString()}`); }
        if (newOptions.trim) {
            const sortedTrimLengths = [
                newOptions.trim.left,
                newOptions.trim.bottom,
                newOptions.trim.right,
                newOptions.trim.top
            ];

            allOptionsAsStrings.push(`trim=${
                sortedTrimLengths
                    .map(length => length.toString())
                    .join(" ")
            }`);
        }
        if (newOptions.clip) { allOptionsAsStrings.push(`clip`); }

        // Unused for now
        // if (newOptions.scale) { optionsAsStrings.push(`scale=${newOptions.scale}`); }
        // if (newOptions.keepaspectratio) { optionsAsStrings.push(`height=${newOptions.height}`); }

        // Aggregate all the key-value parameters into a single string
        const optionsAsUniqueString = allOptionsAsStrings.reduce(
            (str, optionAsString) => `${str}, ${optionAsString}`
        );

        // Surround the options with square brackets if the parameter does not exist in the AST
        // It may exist in the document, but since the AST is used to determine where to inject code,
        // the existence witness must be the AST to get correct positions!
        const replacementText = this.hasOptionsNode ? optionsAsUniqueString : `[${optionsAsUniqueString}]`;

        // TODO: create a generic editor/document editing tool?
        const rangeToEdit = new vscode.Range(this.optionsStartPosition, this.optionsEndPosition);
        await editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, replacementText);
        });
    
        // Update the end position so it matches the end of the new optional parameter
        // Note: this works because the new options are stringified in a single line
        this.optionsEndPosition = this.optionsStartPosition.translate(0, replacementText.length);
    }

    private createWebviewSafeImagePath(): string {
        const absoluteImagePath = this.absoluteImagePath;
        return absoluteImagePath !== null
             ? this.utilities.createWebviewSafeUri(vscode.Uri.file(absoluteImagePath)).toString()
             : "NO_IMAGE_FILE_FOUND";
    }

    protected renderContentAsHTML(): string {
        const uri = this.createWebviewSafeImagePath();
        return `
            <div class="frame">
                <img
                    class="ghost"
                    src="${uri}"
                />
                <div class="inner">
                    <img
                        class="image"
                        src="${uri}"
                    />
                </div>
                <div class="resize"></div>
            </div>
        `;
    }
}

export class IncludegraphicsModelFactory implements VisualisationModelFactory {
    readonly visualisationName = IncludegraphicsModel.visualisationName;
    readonly astMatchingRule = (node: ASTNode) => {
        return node.type === ASTNodeType.Command
            && node.name === "iincludegraphics";
    };

    createModel(node: ASTNode, mapping: CodeMapping, utilities: VisualisationModelUtilities): VisualisationModel {
        return new IncludegraphicsModel(node as ASTCommandNode, mapping, utilities);
    }
}