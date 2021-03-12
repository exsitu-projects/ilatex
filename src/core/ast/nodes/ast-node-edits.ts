import { AtomicSourceFileEditor, SourceFileEditProvider } from "../../source-files/AtomicSourceFileEditor";
import { SourceFileRange } from "../../source-files/SourceFileRange";
import { ASTNode } from "./ASTNode";

export const edits = {
    setTextContent(node: ASTNode, newContent: string): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            editor.replace(node.range, newContent);
        };
    },
    
    // Note: "surrounding whitespace" does not include newline characters
    deleteTextContent(node: ASTNode, trimSurroundingWhitespace: boolean = true): SourceFileEditProvider {
        return async (editor: AtomicSourceFileEditor) => {
            let rangeToDelete = node.range;
            if (trimSurroundingWhitespace) {
                // Determine the start of the leading whitespace (if any)
                // and the end of the trailing whitespace (if any)
                // ON THE SAME LINES THAN THE FIRST AND LAST LINE OF THE NODE'S RANGE!
                const document = await node.sourceFile.document;
        
                const firstLineOfContent = document.lineAt(node.range.from.line);
                const contentBeforeNode = firstLineOfContent.text.substring(0, node.range.from.column);
                const lastNonWhitespaceIndexBeforeNode = Math.max(0, contentBeforeNode.trimRight().length - 1);
        
                const lastLineOfContent = document.lineAt(node.range.to.line);
                const contentAfterNode = lastLineOfContent.text.substring(node.range.to.column);
                const firstNonWhitespaceIndexAfterNode = contentAfterNode.length - contentAfterNode.trimLeft().length;
        
                rangeToDelete = new SourceFileRange(
                    node.range.from.with({ column: lastNonWhitespaceIndexBeforeNode }),
                    node.range.to.with({ column: node.range.to.column + firstNonWhitespaceIndexAfterNode })
                );
            }
        
            editor.delete(rangeToDelete);
        };
    }
};
