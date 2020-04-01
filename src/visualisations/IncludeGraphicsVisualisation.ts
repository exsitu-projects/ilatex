import * as vscode from "vscode";
import * as path from "path";
import { Visualisation } from "./Visualisation";
import { ASTCommandNode, ASTParameterNode, ASTParameterAssignmentsNode } from "../ast/LatexASTNode";
import { WebviewManager } from "../webview/WebviewManager";
import { LatexLength } from "../utils/LatexLength";

interface GraphicsOptions {
    width?: LatexLength;
    height?: LatexLength;
    scale?: number;
    trim?: LatexLength[];
    clip?: boolean;
}

interface Graphics {
    path: string;
    options: GraphicsOptions;
}

interface WebviewImage {
    uri: vscode.Uri | null;
    //width: string;
    //height: string;
    //scale: string;
}

export class IncludeGraphicsVisualisation extends Visualisation<ASTCommandNode> {
    readonly name = "includegraphics";

    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;

    private graphics: Graphics;
    private webviewImage: WebviewImage;

    constructor(node: ASTCommandNode, document: vscode.TextDocument, webviewManager: WebviewManager) {
        super(node);
        
        this.document = document;
        this.webviewManager = webviewManager;

        this.graphics = {
            path: "",
            options: {}
        };

        this.webviewImage = {
            uri: null,
            //width: "",
            //height: "",
            //scale: ""
        };

        this.extractGraphics();
        this.prepareWebviewImage();
        this.initProps();
    }

    protected initProps(): void {
        super.initProps();

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

    private extractGraphicsPath(node: ASTParameterNode): void {
        this.graphics.path = node.value;
    }

    private extractGraphicsOptions(node: ASTParameterAssignmentsNode): void {
        for (let paramAssignmentNode of node.value) {
            const key = paramAssignmentNode.value.key.value.trim();
            const value = paramAssignmentNode.value.value.value.trim();

            if (key === "width") {
                this.graphics.options.width = new LatexLength(value);
            }
            else if (key === "height") {
                this.graphics.options.height = new LatexLength(value);
            }
            else if (key === "scale") {
                this.graphics.options.scale = parseFloat(value);
            }
            else if (key === "trim") {
                this.graphics.options.trim = value
                    .split(/\s+/)
                    .map(lengthText => new LatexLength(lengthText));
            }
            else if (key === "clip") {
                // TODO: handle option declaration with no value in the AST
                this.graphics.options.clip = value.trim().toLowerCase() === "true";
            }
        }
    }
    
    // TODO: refactor by allowing visitors to visit any AST subtree
    private extractGraphics(): void {
        const hasOptionNode = this.node.value.parameters[0].length === 1;
        
        // Extract the options (if any)
        if (hasOptionNode) {
            const optionsParameterNode = this.node.value.parameters[0][0] as ASTParameterAssignmentsNode;
            this.extractGraphicsOptions(optionsParameterNode);
        }

        // Extract the path
        const pathParametetIndex = hasOptionNode ? 1 : 0;
        const pathParameterNode = this.node.value.parameters[pathParametetIndex][0] as ASTParameterNode;

        this.extractGraphicsPath(pathParameterNode);
    }

    private prepareWebviewImage(): void {
        const documentPath = this.document.uri.path;
        const lastSlashIndex = documentPath.lastIndexOf("/");
        const documentDirectoryPath = documentPath.slice(0, lastSlashIndex);

        const imagePath = path.resolve(documentDirectoryPath, this.graphics.path);
        this.webviewImage.uri = this.webviewManager.adaptURI(vscode.Uri.file(imagePath));
    }

    renderContentAsHTML(): string {
        return `
            <p class="text"></p>
            <div class="frame">
                <img
                    class="ghost"
                    src="${this.webviewImage.uri}"
                />
                <div class="inner">
                    <img
                        class="image"
                        src="${this.webviewImage.uri}"
                    />
                </div>
                <div class="resize"></div>
            </div>
        `;
    }
}