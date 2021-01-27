import * as vscode from "vscode";
import * as P from "parsimmon";
import { ASTEnvironementNode } from "../../../core/ast/LatexASTNode";
import { LatexASTVisitorAdapter } from "../../../core/ast/visitors/LatexASTVisitorAdapter";
import { Layout } from "./Layout";
import { CodeMapping } from "../../../core/mappings/CodeMapping";


export class LayoutExtractor extends LatexASTVisitorAdapter {
    private readonly codeMapping: CodeMapping;
    private readonly layout: Layout;

    private constructor(gridlayoutNode: ASTEnvironementNode, mapping: CodeMapping) {
        super();

        this.codeMapping = mapping;
        this.layout = new Layout(gridlayoutNode, mapping);
    }

    private getDocumentContent(start: P.Index, end: P.Index): string {
        return this.codeMapping.sourceFile.document.getText(new vscode.Range(
            new vscode.Position(start.line - 1, start.column - 1),
            new vscode.Position(end.line - 1, end.column - 1)
        ));
    };

    // Note: this method assumes gridlayout environements are never nested!
    protected visitEnvironementNode(node: ASTEnvironementNode) {        
        // Create a new row on every row environment
        if (node.name === "row") {
            this.layout.addNewEmptyRow(node);
        }

        // Every a new cell on every cell environment
        if (node.name === "cell") {
            const cellTextContent = this.getDocumentContent(
                node.value.content.range.from.asParsimmonIndex,
                node.value.content.range.to.asParsimmonIndex
            );

            this.layout.lastRow.addNewCell(node, cellTextContent);
        }
    }

    static extractLayoutFrom(gridlayoutNode: ASTEnvironementNode, mapping: CodeMapping): Layout {
        // Fill a new layout by visiting the AST
        const gridExtractor = new LayoutExtractor(gridlayoutNode, mapping);
        const layout = gridExtractor.layout;
        gridlayoutNode.value.content.visitWith(gridExtractor, 0);

        return layout;
    }
}
