import * as P from "parsimmon";
import { ASTEnvironementNode, ASTParameterNode } from "../../../core/ast/LatexASTNode";
import { LatexLength } from "../../../shared/latex-length/LatexLength";
import { LayoutExtractor } from "./LayoutExtractor";
import { CodeMapping } from "../../../core/mappings/CodeMapping";


export interface CellOptions {
    relativeSize: number;
}

export class Cell {
    readonly rowIndex: number;
    readonly cellIndex: number;

    readonly astNode: ASTEnvironementNode;
    readonly start: P.Index;
    readonly end: P.Index;
    readonly contentStart: P.Index;
    readonly contentEnd: P.Index;

    readonly textContent: string;
    readonly options: CellOptions;

    constructor(
        rowIndex: number,
        cellIndex: number,
        astNode: ASTEnvironementNode,
        textContent: string,
    ) {
        this.rowIndex = rowIndex;
        this.cellIndex = cellIndex;

        this.astNode = astNode;
        this.start = astNode.start;
        this.end = astNode.end;
        this.contentStart = astNode.value.content.start;
        this.contentEnd = astNode.value.content.end;

        this.textContent = textContent;
        this.options = Cell.extractOptionsFrom(astNode);
    }

    private static extractOptionsFrom(cellNode: ASTEnvironementNode): CellOptions {
        const cellRelativeSizeParameter = cellNode.value.parameters[0][0] as ASTParameterNode;
        return {
            relativeSize: parseFloat(cellRelativeSizeParameter.value)
        };
    }
}

export interface RowOptions {
    height: LatexLength;
}

export class Row {
    readonly rowIndex: number;
    readonly astNode: ASTEnvironementNode;
    readonly cells: Cell[];
    readonly options: RowOptions;

    constructor(rowIndex: number, astNode: ASTEnvironementNode) {
        this.rowIndex = rowIndex;
        this.astNode = astNode;
        this.cells = [];
        this.options = Row.extractOptionsFrom(astNode);
    }

    get nbCells(): number {
        return this.cells.length;
    }

    get lastCell(): Cell {
        return this.cells[this.cells.length - 1];
    }

    addNewCell(astNode: ASTEnvironementNode, textContent: string): void {
        this.cells.push(
            new Cell(this.rowIndex, this.nbCells, astNode, textContent)
        );
    }

    private static extractOptionsFrom(rowNode: ASTEnvironementNode): RowOptions {
        const rowHeightParameter = rowNode.value.parameters[0][0] as ASTParameterNode;
        return {
            height: LatexLength.from(rowHeightParameter.value)
        };
    }
}

export interface LayoutOptions {
    width?: LatexLength;
};

export class Layout {
    readonly rows: Row[];
    readonly astNode: ASTEnvironementNode;
    readonly options: LayoutOptions;

    constructor(astNode: ASTEnvironementNode, mapping: CodeMapping) {
        this.rows = [];
        this.astNode = astNode;
        this.options = Layout.extractOptionsFrom(astNode, mapping);
    }

    get nbRows(): number {
        return this.rows.length;
    }

    get lastRow(): Row {
        return this.rows[this.rows.length - 1];
    }

    addNewEmptyRow(astNode: ASTEnvironementNode): void {
        this.rows.push(
            new Row(this.nbRows, astNode)
        );
    }

    private static extractOptionsFrom(gridlayoutNode: ASTEnvironementNode, mapping: CodeMapping): LayoutOptions {
        const options: LayoutOptions = {};
        
        if (gridlayoutNode.value.parameters[0].length > 0) {
            const parameterNode = gridlayoutNode.value.parameters[0][0] as ASTParameterNode;
            options["width"] = LatexLength.from(parameterNode.value, mapping.contextualLatexLengthSettings);
        }

        return options;
    }

    static extractFrom(gridlayoutNode: ASTEnvironementNode, mapping: CodeMapping): Layout {
        return LayoutExtractor.extractLayoutFrom(gridlayoutNode, mapping);
    }
}