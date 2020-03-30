import * as vscode from "vscode";
import * as P from "parsimmon";
import { Visualisation } from "./Visualisation";
import { ASTEnvironementNode, ASTNode, ASTLatexNode, ASTNodeType } from "../ast/LatexASTNode";

interface Cell {
    nodes: ASTNode[];
    row: number;
    column: number;
    textContent: string;
}

export class TabularVisualisation extends Visualisation<ASTEnvironementNode> {
    readonly name = "tabular";

    private document: vscode.TextDocument;
    private cellRows: Cell[][];
    
    constructor(node: ASTEnvironementNode, document: vscode.TextDocument) {
        super(node);

        this.document = document;
        this.cellRows = [];

        this.extractCells();
        this.initProps();
    }

    protected initProps(): void {
        super.initProps();

        // Add node location information
        this.props["data-loc-start"] = `${this.node.start.line};${this.node.start.column}`;
        this.props["data-loc-end"] = `${this.node.end.line};${this.node.end.column}`;

        // Enable the selection of the associated block of code on click
        this.props["class"] += " selectable";
    }

    // TODO: refactor by allowing visitors to visit any AST subtree
    private extractCells(): void {
        let currentRow: Cell[] = [];
        this.cellRows.push(currentRow);

        let nodes: ASTNode[] = [];
        let row = 1;
        let column = 1;
        let startPosition = null;
        let endPosition = null;

        let isCellFirstNode = true;

        const getCellContent = (start: P.Index, end: P.Index): string => {
            return this.document.getText(new vscode.Range(
                new vscode.Position(start.line - 1, start.column - 1),
                new vscode.Position(end.line - 1, end.column - 1)
            ));
        };

        const contentNode = this.node.value.content as ASTLatexNode;
        for (let node of contentNode.value) {
            if (node.type === ASTNodeType.Command
            &&  node.name === "\\\\") {
                if (startPosition && endPosition) {
                    currentRow.push({
                        nodes: nodes,
                        row: row,
                        column: column,
                        textContent: getCellContent(startPosition, endPosition)
                    });

                    nodes = [];
                }

                currentRow = [];
                this.cellRows.push(currentRow);

                row += 1;
                column = 0;
                isCellFirstNode = true;
            }
            else if (node.type === ASTNodeType.SpecialSymbol
                 &&  node.name === "ampersand") {
                if (startPosition && endPosition) {
                    currentRow.push({
                        nodes: nodes,
                        row: row,
                        column: column,
                        textContent: getCellContent(startPosition, endPosition)
                    });

                    nodes = [];
                }

                column += 1;
                isCellFirstNode = true;
            }
            else {
                if (isCellFirstNode) {
                    startPosition = node.start;
                    isCellFirstNode = false;
                }

                nodes.push(node);
                endPosition = node.end;
            }
        }

        if (!isCellFirstNode && startPosition && endPosition) {
            currentRow.push({
                nodes: nodes,
                row: row,
                column: column,
                textContent: getCellContent(startPosition, endPosition)
            });
        }
    }
    
    renderContentAsHTML(): string {
        return `
            <table>
                ${this.cellRows.map(TabularVisualisation.renderRowAsHTML).join("\n")}
            </table>
        `;
    }

    private static renderRowAsHTML(row: Cell[]): string {
        return `
            <tr>
                ${row.map(cell => `<td style="border: 1px solid black;">${cell.textContent}</td>`).join("\n")}
            </tr>
        `;
    }
}