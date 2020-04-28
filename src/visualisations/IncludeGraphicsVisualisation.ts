import * as vscode from "vscode";
import * as path from "path";
import * as P from "parsimmon";
import { Visualisation, WebviewNotificationHandlerSpecification } from "./Visualisation";
import { ASTCommandNode, ASTParameterNode, ASTParameterListNode, ASTParameterAssignmentNode } from "../ast/LatexASTNode";
import { WebviewManager } from "../webview/WebviewManager";
import { LatexLength, LatexLengthOptions } from "../utils/LatexLength";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";

interface GraphicsOptions {
    width?: LatexLength;
    height?: LatexLength;
    scale?: number;
    trim?: LatexLength[];
    clip?: boolean;
    keepaspectratio?: boolean;
}

interface Graphics {
    path: string;
    options: GraphicsOptions;
}

class GraphicsOptionsReader extends LatexASTVisitorAdapter {
    private static readonly LATEX_LENGTH_OPTIONS: LatexLengthOptions = {
         // big points is the default unit for includegraphics (in graphicx package)
        defaultUnit: "bp"
    };

    private options: GraphicsOptions;

    constructor(options: GraphicsOptions) {
        super();
        this.options = options;
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
            this.options.width = LatexLength.from(value, GraphicsOptionsReader.LATEX_LENGTH_OPTIONS);
        }
        else if (key === "height") {
            this.options.height = LatexLength.from(value, GraphicsOptionsReader.LATEX_LENGTH_OPTIONS);
        }
        else if (key === "scale") {
            this.options.scale = parseFloat(value);
        }
        else if (key === "trim") {
            this.options.trim = value
                .split(/\s+/)
                .map(lengthAsText => LatexLength.from(lengthAsText, GraphicsOptionsReader.LATEX_LENGTH_OPTIONS));
        }
        else if (key === "clip") {
            this.options.clip = value.trim().toLowerCase() === "true";
        }
        else if (key === "keepaspectratio") {
            this.options.clip = value.trim().toLowerCase() === "true";
        }
    }
}

export class IncludeGraphicsVisualisation extends Visualisation<ASTCommandNode> {
    readonly name = "includegraphics";

    private webviewImageUri: vscode.Uri | null;
    private graphics: Graphics;

    private hasOptionsNode: boolean;
    private optionsNode: ASTParameterListNode | null;
    private pathNode: ASTParameterNode;

    private optionsStartPosition: vscode.Position;
    private optionsEndPosition: vscode.Position;

    constructor(node: ASTCommandNode, editor: vscode.TextEditor, webviewManager: WebviewManager) {
        super(node, editor, webviewManager);
        
        this.webviewImageUri = null;
        this.graphics = {
            path: "",
            options: {}
        };

        this.hasOptionsNode = this.node.value.parameters[0].length === 1;
        this.optionsNode = this.hasOptionsNode
                         ? this.node.value.parameters[0][0] as ASTParameterListNode
                         : null;
        this.pathNode = this.node.value.parameters[1][0] as ASTParameterNode;
        
        // Pre-compute values required to determine where to insert/replace command options
        const optionsStart = this.hasOptionsNode
                           ? this.optionsNode!.start
                           : this.node.value.nameEnd;
        const optionsEnd = this.hasOptionsNode
                         ? this.optionsNode!.end
                         : this.node.value.nameEnd;

        this.optionsStartPosition = new vscode.Position(optionsStart.line - 1, optionsStart.column - 1);
        this.optionsEndPosition = new vscode.Position(optionsEnd.line - 1, optionsEnd.column - 1);
        

        this.extractGraphics();
        this.prepareWebviewImage();
        this.initProps();
    }

    protected initProps(): void {
        super.initProps();

        // Add the original path of the image
        this.props["data-img-path"] = this.graphics.path;

        // Add the dimensions of the image
        // TODO: compute the actual dimensions of the image
        //this.props["data-img-width"] = "256";
        //this.props["data-img-height"] = "256";

        // Add node location information
        this.props["data-loc-start"] = `${this.node.start.line};${this.node.start.column}`;
        this.props["data-loc-end"] = `${this.node.end.line};${this.node.end.column}`;

        // Add graphics option information
        // TODO: what to do when the length cannot be converted?
        const options = this.graphics.options;

        if (options.width?.canBeConverted) {
            this.props[`data-opt-width`] = options.width.px.toString();
        }

        if (options.height?.canBeConverted) {
            this.props[`data-opt-height`] = options.height.px.toString();
        }

        if (options.scale !== undefined) {
            this.props[`data-opt-scale`] = options.scale.toString();
        }

        if (options.trim !== undefined) {
            this.props[`data-opt-trim-left`] = options.trim[0].px.toString();
            this.props[`data-opt-trim-bottom`] = options.trim[1].px.toString();
            this.props[`data-opt-trim-right`] = options.trim[2].px.toString();
            this.props[`data-opt-trim-top`] = options.trim[3].px.toString();
        }

        if (options.clip !== undefined) {
            this.props[`data-opt-clip`] = options.clip ? "true" : "false";
        }

        // Enable the selection of the associated block of code on click
        this.props["class"] += " selectable";
    }

    protected getWebviewNotificationHandlerSpecifications(): WebviewNotificationHandlerSpecification[] {
        return [
            ...super.getWebviewNotificationHandlerSpecifications(),

            {
                subject: "set-options",
                handler: async (payload) => {
                    const optionsAsStr = payload.optionsAsStr as string;
                    await this.setGraphicsOptions(optionsAsStr);
                }
            }
        ];
    }

    private extractGraphicsPath(): void {
        this.graphics.path = this.pathNode.value;
    }

    private extractGraphicsOptions(): void {
        const optionsReader = new GraphicsOptionsReader(this.graphics.options);
        this.optionsNode!.visitWith(optionsReader);
    }
    
    private extractGraphics(): void {
        // Extract the options (if any)
        if (this.hasOptionsNode) {
            this.extractGraphicsOptions();
        }

        // Extract the path
        this.extractGraphicsPath();
    }

    private async setGraphicsOptions(optionsAsStr: string): Promise<void> {
        // Surround the options with squre brackets if the parameter does not exist in the AST
        // It may exist in the document, but since the AST is used to determine where to inject code,
        // the existence witness must be the AST to get correct positions
        // (this prevents brackets from being duplicated)
        const replacementText = this.hasOptionsNode ? optionsAsStr : `[${optionsAsStr}]`;

        // TODO: create a generic editor/document editing tool?
        const rangeToEdit = new vscode.Range(this.optionsStartPosition, this.optionsEndPosition);

        console.log("======== Replacement ========");
        console.log("BEFORE REPLACE: ", this.editor.document.getText(rangeToEdit));
        console.log("BY", replacementText);

        await this.editor.edit(editBuilder => {
            editBuilder.replace(rangeToEdit, replacementText);
        });
 
        this.optionsEndPosition = this.optionsStartPosition.translate(0, replacementText.length);

        console.log("AFTER REPLACE: ", this.editor.document.getText(
            new vscode.Range(this.optionsStartPosition, this.optionsEndPosition)
        ));
    }

    private prepareWebviewImage(): void {
        const documentPath = this.editor.document.uri.path;
        const lastSlashIndex = documentPath.lastIndexOf("/");
        const documentDirectoryPath = documentPath.slice(0, lastSlashIndex);

        const imagePath = path.resolve(documentDirectoryPath, this.graphics.path);
        this.webviewImageUri = this.webviewManager.adaptURI(vscode.Uri.file(imagePath));
    }

    renderContentAsHTML(): string {
        return `
            <div class="frame">
                <img
                    class="ghost"
                    src="${this.webviewImageUri}"
                />
                <div class="inner">
                    <img
                        class="image"
                        src="${this.webviewImageUri}"
                    />
                </div>
                <div class="resize"></div>
            </div>
        `;
    }
}