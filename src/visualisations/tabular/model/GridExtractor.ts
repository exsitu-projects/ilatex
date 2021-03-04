import * as vscode from "vscode";
import { ASTNode } from "../../../core/ast/nodes/ASTNode";
import { CommandNode } from "../../../core/ast/nodes/CommandNode";
import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { SpecialSymbolNode } from "../../../core/ast/nodes/SpecialSymbolNode";
import { ASTAsyncVisitorAdapter } from "../../../core/ast/visitors/adapters";
import { Cell, Grid, Row } from "./Grid";
import { GridOptions } from "./GridOptions";


export class GridExtractor extends ASTAsyncVisitorAdapter {
    private tabularNode: EnvironmentNode;

    private lastCellOrRowSeparatorNode: ASTNode | null;
    private unusedVisitedNodes: ASTNode[];
    private unusedCells: Cell[];
    private rows: Row[];

    private constructor(tabularNode: EnvironmentNode) {
        super();

        this.tabularNode = tabularNode;

        this.lastCellOrRowSeparatorNode = null;
        this.unusedVisitedNodes = [];
        this.unusedCells = [];
        this.rows = [];
    }

    async createGrid(): Promise<Grid> {
        return new Grid(
            this.rows,
            this.unusedVisitedNodes,
            await GridOptions.from(this.tabularNode)
        );
    }

    private get nextRowIndex(): number {
        return this.rows.length;
    }

    private get nextColumnIndex(): number {
        return this.unusedCells.length;
    }

    private async createNewCell(separatorNode: ASTNode | null) {
        this.unusedCells.push(await Cell.from(
            this.nextRowIndex,
            this.nextColumnIndex,
            [...this.unusedVisitedNodes],
            this.lastCellOrRowSeparatorNode,
            separatorNode
        ));

        this.lastCellOrRowSeparatorNode = separatorNode;
        this.unusedVisitedNodes = [];
    }

    private async createNewRow() {
        this.rows.push(await Row.from(
            this.nextRowIndex,
            [...this.unusedCells]
        ));

        this.unusedCells = [];
    }

    // Every \\ command creates both a new cell and new row
    // Every other command is treated as a cell node
    async visitCommandNode(node: CommandNode) {
        if (node.name === "\\") {
            await this.createNewCell(node);
            await this.createNewRow();
        }
        else {
            this.unusedVisitedNodes.push(node);
        }
    }

    // Every & symbol creates a new cell
    // Every other special symbol is treated as a cell node
    async visitSpecialSymbolNode(node: SpecialSymbolNode) {
        if (node.symbol === "&") {
            await this.createNewCell(node);
        }
        else {
            this.unusedVisitedNodes.push(node);
        }
    }

    // Every other node with no special meaning is treated as a regular cell node
    // (except the single node at depth 0, that contains the whole body of the environment)
    async visitNode(node: ASTNode, depth: number) {
        if (depth === 0) {
            return;
        }

        this.unusedVisitedNodes.push(node);
    }

    private async processUnusedData(): Promise<void> {
        // If there remains 1+ unused visited nodes,
        // and if there is at least one content node among them,
        // create a new node
        if (this.unusedVisitedNodes.length > 0
        &&  !this.unusedVisitedNodes.some(Cell.isContentNode)) {
            this.createNewCell(null);
        }

        // If there remains 1+ unused cells, create a new row
        if (this.unusedCells.length > 0) {
            this.createNewRow();
        }
    }

    static async extractGridFrom(tabularNode: EnvironmentNode): Promise<Grid> {
        const gridExtractor = new GridExtractor(tabularNode);

        await tabularNode.body.asyncVisitWith(gridExtractor, 0, 1);
        await gridExtractor.processUnusedData();

        return await gridExtractor.createGrid();
    }
}
