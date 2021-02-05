import { EnvironmentNode } from "../../../core/ast/nodes/EnvironmentNode";
import { ASTVisitorAdapter } from "../../../core/ast/visitors/ASTVisitorAdapter";
import { CodeMapping } from "../../../core/code-mappings/CodeMapping";
import { Cell, Layout, Row } from "./Layout";


export class LayoutExtractionError {}

export class LayoutContentExtractor extends ASTVisitorAdapter {
    private readonly codeMapping: CodeMapping;
    private readonly layout: Layout;

    private constructor(
        emptyLayout: Layout,
        codeMapping: CodeMapping
    ) {
        super();

        this.codeMapping = codeMapping;
        this.layout = emptyLayout;
    }

    // Note: this method assumes gridlayout environements are never nested!
    async visitEnvironmentNode(node: EnvironmentNode) {
        // Create a new row on every row environment
        if (node.name === "row") {
            this.layout.rows.push(
                await Row.from(
                    this.layout.nbRows,
                    node,
                    this.codeMapping
                )
            );
        }

        // Create a new cell on every cell environment
        else if (node.name === "cell") {
            this.layout.lastRow.cells.push(
                await Cell.from(
                    this.layout.nbRows,
                    this.layout.lastRow.nbCells,
                    node
                )
            );
        }
    }

    static async fillLayout(
        emptyLayout: Layout,
        codeMapping: CodeMapping
    ): Promise<void> {
        // Fill the layout by visiting the AST subtree of the environment
        const gridExtractor = new LayoutContentExtractor(emptyLayout, codeMapping);
        await emptyLayout.astNode.visitWith(gridExtractor, 0);
    }
}
