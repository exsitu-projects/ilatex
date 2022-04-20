import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../../../core/ast/LatexParser";
import { CommandNode } from "../../../core/ast/nodes/CommandNode";
import { CurlyBracesParameterBlockNode } from "../../../core/ast/nodes/CurlyBracesParameterBlockNode";
import { ParameterNode } from "../../../core/ast/nodes/ParameterNode";
import { SquareBracesParameterBlockNode } from "../../../core/ast/nodes/SquareBracesParameterBlockNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { TransitionalModelUtilities } from "../../../core/transitionals/TransitionalModelUtilities";
import { ImageOptions } from "./ImageOptions";

export class ImageLocationError {}

export class Image {
    readonly rawPath: string;
    readonly rawPathParameterBlockNode: CurlyBracesParameterBlockNode;
    readonly uri: vscode.Uri;

    readonly options: ImageOptions;
    readonly optionsParameterBlockNode: SquareBracesParameterBlockNode | EmptyASTValue;

    private constructor(
        rawPath: string,
        rawPathParameterBlockNode: CurlyBracesParameterBlockNode,
        uri: vscode.Uri,
        options: ImageOptions,
        optionsParameterBlockNode: SquareBracesParameterBlockNode | EmptyASTValue,
    ) {
        this.rawPath = rawPath;
        this.rawPathParameterBlockNode = rawPathParameterBlockNode;

        this.uri = uri;

        this.options = options;
        this.optionsParameterBlockNode = optionsParameterBlockNode;
    }

    private static createAbsoluteImageUriFrom(
        rawPath: string,
        codeMapping: CodeMapping,
        utilities: TransitionalModelUtilities
    ): vscode.Uri | null {
        const relativePathsToImageDirectories = new Set(codeMapping.context.graphicsPaths);
        relativePathsToImageDirectories.add(".");

        for (let relativePathToAnImageDirectory of relativePathsToImageDirectories) {
            // We assume all the paths are relative to the the main source file's directory
            const absoluteImagePath = path.resolve(
                path.dirname(utilities.mainSourceFileUri.path),
                relativePathToAnImageDirectory,
                rawPath
            );
            
            if (fs.existsSync(absoluteImagePath)) {
                return vscode.Uri.file(absoluteImagePath);
            }
        }

        return null;
    }

    static async from(
        includegraphicsNode: CommandNode,
        codeMapping: CodeMapping,
        utilities: TransitionalModelUtilities
    ): Promise<Image> {
        const rawPathParameterBlockNode =
            includegraphicsNode.parameters[1] as CurlyBracesParameterBlockNode;
        const rawPath = (rawPathParameterBlockNode.content as ParameterNode).value;

        const uri = Image.createAbsoluteImageUriFrom(rawPath, codeMapping, utilities);
        if (!uri) {
            throw new ImageLocationError();
        }

        const optionsParameterBlockNode =
            includegraphicsNode.parameters[0] as SquareBracesParameterBlockNode | EmptyASTValue;
        const options = await ImageOptions.from(optionsParameterBlockNode, codeMapping);

        return new Image(
            rawPath,
            rawPathParameterBlockNode,
            uri,
            options,
            optionsParameterBlockNode
        );
    }
}