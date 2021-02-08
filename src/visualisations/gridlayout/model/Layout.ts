import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { RangeInFile } from "../../../core/utils/RangeInFile";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { CurlyBracesParameterBlockNode } from "../../../core/ast/nodes/CurlyBracesParameterBlockNode";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { EMPTY_AST_VALUE } from "../../../core/ast/LatexParser";
import { LayoutContentExtractor, LayoutExtractionError } from "./LayoutContentExtractor";
import { ParameterNode } from "../../../core/ast/nodes/ParameterNode";


export class CellOptions {
    readonly relativeSize: number;
    readonly relativeSizeParameterNode: ParameterNode;

    private constructor(relativeSize: number, relativeSizeParameterNode: ParameterNode) {
        this.relativeSize = relativeSize;
        this.relativeSizeParameterNode = relativeSizeParameterNode;
    }

    static async fromCellNode(node: EnvironmentNode): Promise<CellOptions> {
        const parameterBlockNode = node.parameters[0] as CurlyBracesParameterBlockNode;
        const relativeSizeParameterNode = parameterBlockNode.content as ParameterNode;
        const relativeSize = parseFloat(await parameterBlockNode.content.textContent);

        if (Number.isNaN(relativeSize)) {
            throw new LayoutExtractionError();
        }

        return new CellOptions(relativeSize, relativeSizeParameterNode);
    }
}

export class Cell {
    readonly rowIndex: number;
    readonly cellIndex: number;

    readonly astNode: EnvironmentNode;
    readonly range: RangeInFile;
    readonly contentRange: RangeInFile;

    readonly contentText: string;
    readonly options: CellOptions;

    private constructor(
        rowIndex: number,
        cellIndex: number,
        astNode: EnvironmentNode,
        textContent: string,
        options: CellOptions
    ) {
        this.rowIndex = rowIndex;
        this.cellIndex = cellIndex;

        this.astNode = astNode;
        this.range = astNode.range;
        this.contentRange = astNode.body.range;

        this.contentText = textContent;
        this.options = options;
    }

    static async from(
        rowIndex: number,
        cellIndex: number,
        node: EnvironmentNode
    ): Promise<Cell> {
        const contentText = await node.body.textContent;
        const options = await CellOptions.fromCellNode(node);

        return new Cell(rowIndex, cellIndex, node, contentText, options);
    }
}

export class RowOptions {
    readonly height: LatexLength;
    readonly heightParameterNode: ParameterNode;

    private constructor(height: LatexLength, heightParameterNode: ParameterNode) {
        this.height = height;
        this.heightParameterNode = heightParameterNode;
    }

    static async fromRowNode(node: EnvironmentNode, codeMapping: CodeMapping): Promise<RowOptions> {
        const parameterBlockNode = node.parameters[0] as CurlyBracesParameterBlockNode;
        const heightParameterNode = parameterBlockNode.content as ParameterNode;

        try {
            const height = LatexLength.from(
                await parameterBlockNode.content.textContent,
                codeMapping.localLatexLengthSettings
            );
            return new RowOptions(height, heightParameterNode);
        }
        catch (error) {
            throw new LayoutExtractionError();
        }
    }
}

export class Row {
    readonly rowIndex: number;
    readonly astNode: EnvironmentNode;
    readonly cells: Cell[];
    readonly options: RowOptions;

    private constructor(rowIndex: number, astNode: EnvironmentNode, options: RowOptions) {
        this.rowIndex = rowIndex;
        this.astNode = astNode;
        this.cells = [];
        this.options = options;
    }

    get nbCells(): number {
        return this.cells.length;
    }

    get lastCell(): Cell {
        return this.cells[this.cells.length - 1];
    }

    static async from(
        rowIndex: number,
        node: EnvironmentNode,
        codeMapping: CodeMapping
    ): Promise<Row> {
        const options = await RowOptions.fromRowNode(node, codeMapping);
        return new Row(rowIndex, node, options);
    }
}

export class LayoutOptions {
    readonly width?: LatexLength;

    private constructor(width?: LatexLength) {
        this.width = width;
    }

    static async from(
        node: EnvironmentNode,
        codeMapping: CodeMapping
    ): Promise<LayoutOptions> {
        const rowHeightParameter = node.parameters[0];
        if (rowHeightParameter === EMPTY_AST_VALUE) {
            return new LayoutOptions();
        }
        
        try {
            const width = LatexLength.from(
                await rowHeightParameter.content.textContent,
                codeMapping.localLatexLengthSettings
            );
            return new LayoutOptions(width);
        }
        catch (error) {
            throw new LayoutExtractionError();
        }
    }
}

export class Layout {
    readonly rows: Row[];
    readonly astNode: EnvironmentNode;
    readonly options: LayoutOptions;

    constructor(astNode: EnvironmentNode, options: LayoutOptions) {
        this.rows = [];
        this.astNode = astNode;
        this.options = options;
    }

    get nbRows(): number {
        return this.rows.length;
    }

    get lastRow(): Row {
        return this.rows[this.rows.length - 1];
    }

    static async createEmptyLayoutFrom(
        node: EnvironmentNode,
        codeMapping: CodeMapping
    ): Promise<Layout> {
        const options = await LayoutOptions.from(node, codeMapping);
        return new Layout(node, options);
    }

    static async from(
        gridlayoutNode: EnvironmentNode,
        codeMapping: CodeMapping
    ): Promise<Layout> {
        const layout = await Layout.createEmptyLayoutFrom(gridlayoutNode, codeMapping);
        await LayoutContentExtractor.fillLayout(layout, codeMapping);

        return layout;
    }
}

