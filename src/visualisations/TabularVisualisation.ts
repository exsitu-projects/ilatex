import { Visualisation } from "./Visualisation";
import { ASTEnvironementNode, ASTNode, ASTLatexNode, ASTNodeType } from "../ast/LatexASTNode";

interface Cell {
    node: ASTNode;
    row: number;
    column: number;
    textContent: string;
}

export class TabularVisualisation implements Visualisation {
    private node: ASTEnvironementNode;
    private cellRows: Cell[][];
    
    constructor(node: ASTEnvironementNode) {
        this.node = node;
        this.cellRows = [];

        this.extractCells();
    }

    // TODO: refactor by allowing visitors to visit any AST subtree
    private extractCells(): void {
        let currentRow: Cell[] = [];
        this.cellRows.push(currentRow);

        let row = 1;
        let column = 1;

        const contentNode = this.node.value.content as ASTLatexNode;
        for (let node of contentNode.value) {
            if (node.type === ASTNodeType.Command
            &&  node.name === "\\\\") {
                currentRow = [];
                this.cellRows.push(currentRow);

                row += 1;
                column = 0;
            }
            else if (node.type === ASTNodeType.SpecialSymbol
                 &&  node.name === "ampersand") {
                column += 1;
            }
            else {
                currentRow.push({
                    node: node,
                    row: row,
                    column: column,
                    textContent: "TODO"
                });
            }
        }
    }
    
    renderAsHTML(): string {
        return `
            <table class="ilatex-tabular">
                ${this.cellRows.map(TabularVisualisation.renderRowAsHTML).join("\n")}
            </table>
        `;
    }

    private static renderRowAsHTML(row: Cell[]): string {
        return `
            <tr>
                ${row.map(cell => `<td>${cell.textContent}</td>`).join("\n")}
            </tr>
        `;
    }
}