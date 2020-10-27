import * as vscode from "vscode";
import * as path from "path";
import { VisualisationModelFactory, VisualisationModel } from "../../../core/visualisations/VisualisationModel";
import { AbstractVisualisationModel, NotificationHandlerSpecification } from "../../../core/visualisations/AbstractVisualisationModel";
import { ASTNode, ASTCommandNode, ASTNodeType, ASTParameterListNode, ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { InteractiveLaTeX } from "../../../core/InteractiveLaTeX";
import { Options, OptionsExtractor } from "./OptionsExtractor";
import { LatexLength } from "../../../shared/utils/LatexLength";
import { WebviewManager } from "../../../core/webview/WebviewManager";


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

    constructor(node: ASTCommandNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, ilatex, editor, webviewManager);

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

    private extractImagePathFromASTNode(): string {
        return this.pathNode.value;
    }

    private extractOptionsFromASTNode(): Options {
        if (!this.hasOptionsNode) {
            return {};
        }

        const optionsReader = new OptionsExtractor();
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
        if (this.options.width?.canBeConverted) {
            contentAttributes["data-opt-width"] = this.options.width.px.toString();
        }

        if (this.options.height?.canBeConverted) {
            contentAttributes["data-opt-height"] = this.options.height.px.toString();
        }

        if (this.options.scale !== undefined) {
            contentAttributes["data-opt-scale"] = this.options.scale.toString();
        }

        if (this.options.trim !== undefined) {
            contentAttributes["data-opt-trim-left"] = this.options.trim[0].px.toString();
            contentAttributes["data-opt-trim-bottom"] = this.options.trim[1].px.toString();
            contentAttributes["data-opt-trim-right"] = this.options.trim[2].px.toString();
            contentAttributes["data-opt-trim-top"] = this.options.trim[3].px.toString();
        }

        if (this.options.clip !== undefined) {
            contentAttributes["data-opt-clip"] = this.options.clip ? "true" : "false";
        }

        return contentAttributes;
    }

    protected createNotificationHandlerSpecifications(): NotificationHandlerSpecification[] {
        return [
            ...super.createNotificationHandlerSpecifications(),

            {
                title: "set-options",
                handler: async payload => {
                    const newOptionsInPx = payload.newOptions;
                    const newOptions: Options = {};
                    if (newOptionsInPx.width) { newOptions.width = new LatexLength(newOptionsInPx.width, "px"); }
                    if (newOptionsInPx.height) { newOptions.height = new LatexLength(newOptionsInPx.height, "px"); }
                    if (newOptionsInPx.scale) { newOptions.scale = newOptionsInPx.scale; }
                    if (newOptionsInPx.clip) { newOptions.clip = newOptionsInPx.clip; }
                    if (newOptionsInPx.trim) {
                        newOptions.trim = [
                            new LatexLength(newOptionsInPx.trim.left, "px"),
                            new LatexLength(newOptionsInPx.trim.bottom, "px"),
                            new LatexLength(newOptionsInPx.trim.right, "px"),
                            new LatexLength(newOptionsInPx.trim.top, "px"),
                        ];
                    ;}

                    await this.updateOptions(newOptions);
                }
            }
        ];
    }

    private async updateOptions(newOptions: Options): Promise<void> {
        // Transform options as optional key-value  parameters for the includegraphics command
        const allOptionsAsStrings = [];
        if (newOptions.width) { allOptionsAsStrings.push(`width=${newOptions.width.px}px`); }
        if (newOptions.height) { allOptionsAsStrings.push(`height=${newOptions.height.px}px`); }
        if (newOptions.trim) { 
            allOptionsAsStrings.push(`trim=${newOptions.trim.reduce(
                (value, length) => `${value} ${length.px}`, "")
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
        await this.editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, replacementText);
        });
    
        // Update the end position so it matches the end of the new optional parameter
        // Note: this works because the new options are stringified in a single line
        this.optionsEndPosition = this.optionsStartPosition.translate(0, replacementText.length);
    }

    private createWebviewImageUri(): vscode.Uri {
        const documentPath = this.editor.document.uri.path;
        const lastSlashIndex = documentPath.lastIndexOf("/");
        const documentDirectoryPath = documentPath.slice(0, lastSlashIndex);

        const imagePath = path.resolve(documentDirectoryPath, this.imagePath);
        return this.webviewManager.adaptURI(vscode.Uri.file(imagePath));
    }

    protected renderContentAsHTML(): string {
        const uri = this.createWebviewImageUri();
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
    readonly codePatternMatcher = (node: ASTNode) => {
        return node.type === ASTNodeType.Command
            && node.name === "includegraphics";
    };

    createModel(node: ASTNode, ilatex: InteractiveLaTeX, editor: vscode.TextEditor, webviewManager: WebviewManager): VisualisationModel {
        return new IncludegraphicsModel(node as ASTCommandNode, ilatex, editor, webviewManager);
    }
}