import { AtomicSourceFileEditor, SourceFileEditProvider } from "../../source-files/AtomicSourceFileEditor";
import { SourceFilePosition } from "../../source-files/SourceFilePosition";
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
                const document = await node.sourceFile.document;
        
                // Determine whether the content on the start line before the start column
                // and the content on the end line after the end column is only whitespace or not
                // If it is, the whole start/end lines must be deleted
                // First, ensure the whitespace on the start line but before the start column
                // and the whitespace on the end line but after the end column are removed
                const firstLineOfContent = document.lineAt(node.range.from.line);
                const contentBeforeNode = firstLineOfContent.text.substring(0, node.range.from.column);
                const lastNonWhitespaceIndexBeforeNode = Math.max(0, contentBeforeNode.trimRight().length - 1);
        
                const lastLineOfContent = document.lineAt(node.range.to.line);
                const contentAfterNode = lastLineOfContent.text.substring(node.range.to.column);
                const firstNonWhitespaceIndexAfterNode = contentAfterNode.length - contentAfterNode.trimLeft().length;

                // In addition, if the whole content before/after the start/end of the node on the start/end lines
                // is entirely made of whitespace, trim as many empty lines before and after as possible
                let start = node.range.from.with({ column: lastNonWhitespaceIndexBeforeNode });
                if (contentBeforeNode.trim().length === 0) {
                    for (let line = start.line; line >= 0; line--) {
                        const lineInDocument = document.lineAt(line);

                        // If the first line of the node is about to be fully deleted,
                        // the range should start at the end of the previous line to remove
                        // the newline character before (to avoid leaving an enpty line with no content)
                        if (!lineInDocument.isEmptyOrWhitespace && line !== node.range.from.line) {
                            break;
                        }

                        start = line === 0
                            ? SourceFilePosition.fromVscodePosition(lineInDocument.range.start)
                            : SourceFilePosition.fromVscodePosition(document.lineAt(line - 1).range.end);
                    }
                }

                let end = node.range.to.with({ column: node.range.to.column + firstNonWhitespaceIndexAfterNode });
                if (contentAfterNode.trim().length === 0) {
                    for (let line = end.line; line < document.lineCount; line++) {
                        const lineInDocument = document.lineAt(line);
                        if (!lineInDocument.isEmptyOrWhitespace) {
                            break;
                        }

                        end = line === document.lineCount - 1
                            ? SourceFilePosition.fromVscodePosition(lineInDocument.range.end)
                            : SourceFilePosition.fromVscodePosition(document.lineAt(line + 1).range.start);
                    }
                }
        
                rangeToDelete = new SourceFileRange(start, end);
            }
        
            editor.delete(rangeToDelete);
        };
    }
};
