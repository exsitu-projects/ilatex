import * as vscode from "vscode";
import { TransitionalModel, ViewMessageHandlerSpecification } from "../../../core/transitionals/TransitionalModel";
import { CommandNode } from "../../../core/ast/nodes/CommandNode";
import { VisualisableCodeContext } from "../../../core/transitionals/TransitionalModelProvider";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { Image } from "./Image";
import { ImageOptions, RawImageOptions, SupportedImageOptions } from "./ImageOptions";
import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";
import { CurlyBracesParameterBlockNode } from "../../../core/ast/nodes/CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "../../../core/ast/nodes/SquareBracesParameterBlockNode";
import { TransientSourceFileEditor } from "../../../core/source-files/TransientSourceFileEditor";

export class ImageTransitionalModel extends TransitionalModel<CommandNode> {
    readonly transitionalName = "includegraphics";
    private image: Image | null;

    private transientImageOptionsEditor: TransientSourceFileEditor | null;

    constructor(context: VisualisableCodeContext<CommandNode>, utilities: TransitionalModelUtilities) {
        super(context, utilities);
        this.image = null;

        this.transientImageOptionsEditor = null;
    }

    protected get contentDataAsHtml(): string {
        return this.rendeImageAsHtml();
    }

    protected get contentHtmlAttributes(): Record<string, string> {
        const attributes = super.contentHtmlAttributes;
        const rawImageOptions = this.image?.options.raw;

        if (rawImageOptions) {
            if (rawImageOptions.width) { attributes["data-option-width"] = rawImageOptions.width.toString(); }
            if (rawImageOptions.height) { attributes["data-option-height"] = rawImageOptions.height.toString(); }
            if (rawImageOptions.scale) { attributes["data-option-scale"] = rawImageOptions.scale.toString(); }
            if (rawImageOptions.trim) {
                attributes["data-option-trim-left"] = rawImageOptions.trim.left.toString();
                attributes["data-option-trim-bottom"] = rawImageOptions.trim.bottom.toString();
                attributes["data-option-trim-right"] = rawImageOptions.trim.right.toString();
                attributes["data-option-trim-top"] = rawImageOptions.trim.top.toString();
            }
        }

        return attributes;
    }

    protected get viewMessageHandlerSpecifications(): ViewMessageHandlerSpecification[] {
        return [
            ...super.viewMessageHandlerSpecifications,

            {
                title: "set-options",
                handler: async payload => {
                    const { newOptions, changeType, isFinalUpdate } = payload;

                    const newRawOptions = newOptions as RawImageOptions;
                    await this.updateImageOptionParameterUsing(newRawOptions, isFinalUpdate);
                    this.registerChangeRequestedByTheView();

                    if (isFinalUpdate) {
                        this.logEvent(changeType);
                    }
                }
            }
        ];
    }

    private async updateImageOptionParameterUsing(newRawOptions: RawImageOptions, isFinalUpdate: boolean): Promise<void> {
        if (!this.image) {
            return;
        }

        // Transform all options as key-value parameters for the includegraphics command
        const optionsAsStrings = new Map<string, string | true>();

        // If a length option already exist, reuse its unit and its suffix (if any)
        // Otherwise, create a new LatexLength with the value in pixels (so it is automatically rounded!)
        const makeStringForLength = (lengthInPx: number, currentLength: LatexLength | undefined): string => {
            return currentLength
                ? currentLength.withValue(lengthInPx, "px").toString()
                : new LatexLength(lengthInPx, "px", "", this.codeMapping.localLatexLengthSettings).toString();
        };

        if (newRawOptions.width) {
            optionsAsStrings.set("width", makeStringForLength(newRawOptions.width, this.image?.options.width?.value));
        }
        if (newRawOptions.height) {
            optionsAsStrings.set("height", makeStringForLength(newRawOptions.height, this.image?.options.height?.value));
        }
        if (newRawOptions.scale) {
            optionsAsStrings.set("scale", newRawOptions.scale.toString());
        }

        // if (newRawOptions.width && newRawOptions.)

        // TODO: ignore the trimming if all trim values are 0
        if (newRawOptions.clip) {
            optionsAsStrings.set("clip", true);
        }
        if (newRawOptions.trim) {
            optionsAsStrings.set(
                "trim", 
                [
                    makeStringForLength(newRawOptions.trim.left, this.image?.options.trim?.value.left),
                    makeStringForLength(newRawOptions.trim.bottom, this.image?.options.trim?.value.bottom),
                    makeStringForLength(newRawOptions.trim.right, this.image?.options.trim?.value.right),
                    makeStringForLength(newRawOptions.trim.top, this.image?.options.trim?.value.top)
                ].join(" ")
            );
        }

        // Create a new option parameter block (including the surrounding square brackets)
        const newOptionParameterBlockContent = [...optionsAsStrings.entries()]
            .map(([key, value]) => value === true ? `${key}` : `${key}=${value}`)
            .join(", ");
        const newOptionParameterBlock = `[${newOptionParameterBlockContent}]`;

        if (!this.transientImageOptionsEditor) {
            const editRange = new SourceFileRange(
                this.astNode.nameEnd,
                (this.astNode.parameters[1] as CurlyBracesParameterBlockNode).range.from
            );
    
            this.transientImageOptionsEditor = this.sourceFile.createTransientEditor([{
                name: "options",
                range: editRange
            }]);
            await this.transientImageOptionsEditor.init();
        }
        
        await this.transientImageOptionsEditor.replaceSectionContent("options", newOptionParameterBlock);
        if (isFinalUpdate) {
            await this.transientImageOptionsEditor.applyChange();
            this.transientImageOptionsEditor = null;
        }
    }

    protected async updateContentData(): Promise<void> {
        try {
            this.image = await Image.from(
                this.astNode,
                this.codeMapping,
                this.utilities
            );
            this.contentUpdateEndEventEmitter.fire(true);

            // console.log("New image model:", this.image);
        }
        catch (error) {
            console.log(`The content data update of the transitional with UID ${this.uid} (${this.transitionalName}) failed.`);
            this.contentUpdateEndEventEmitter.fire(false);
        }
    }

    private rendeImageAsHtml(): string {
        if (!this.image) {
            return "";
        }

        const webviewSafeImageUri = this.utilities.createWebviewSafeUri(this.image.uri);
        return `
            <div class="frame">
                <img
                    class="ghost"
                    src="${webviewSafeImageUri}"
                />
                <div class="inner">
                    <img
                        class="image"
                        src="${webviewSafeImageUri}"
                    />
                </div>
                <div class="resize"></div>
            </div>
        `;
    }
}