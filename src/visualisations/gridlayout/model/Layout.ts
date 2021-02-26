import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { SourceFileRange } from "../../../core/source-files/SourceFileRange";
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
    readonly range: SourceFileRange;
    readonly contentRange: SourceFileRange;

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
    readonly relativeSize: number;
    readonly relativeSizeParameterNode: ParameterNode;

    private constructor(relativeSize: number, heightParameterNode: ParameterNode) {
        this.relativeSize = relativeSize;
        this.relativeSizeParameterNode = heightParameterNode;
    }

    static async fromRowNode(node: EnvironmentNode): Promise<RowOptions> {
        const parameterBlockNode = node.parameters[0] as CurlyBracesParameterBlockNode;
        const relativeSizeParameterNode = parameterBlockNode.content as ParameterNode;
        const relativeSize = parseFloat(await parameterBlockNode.content.textContent);

        if (Number.isNaN(relativeSize)) {
            throw new LayoutExtractionError();
        }

        return new RowOptions(relativeSize, relativeSizeParameterNode);
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
        node: EnvironmentNode
    ): Promise<Row> {
        const options = await RowOptions.fromRowNode(node);
        return new Row(rowIndex, node, options);
    }
}

export class LayoutOptions {
    readonly width: LatexLength;
    readonly height: LatexLength;

    private constructor(width: LatexLength, height: LatexLength) {
        this.width = width;
        this.height = height;
    }

    static async from(
        node: EnvironmentNode,
        codeMapping: CodeMapping
    ): Promise<LayoutOptions> {
        const gridWidthParameter = node.parameters[0] as CurlyBracesParameterBlockNode;
        const gridHeightParameter = node.parameters[1] as CurlyBracesParameterBlockNode;
        
        try {
            const createLatexLengthFrom = (text: string) => LatexLength.from(
                text,
                codeMapping.localLatexLengthSettings
            );

            const width = createLatexLengthFrom(await gridWidthParameter.content.textContent);
            const height = createLatexLengthFrom(await gridHeightParameter.content.textContent);

            return new LayoutOptions(width, height);
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

