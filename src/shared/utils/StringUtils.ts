export abstract class StringUtils {
    static countLinesOf(text: string): number {
        return (text.match(/\n/g) || []).length + 1;
    }

    static lastLineOf(text: string): string {
        const lastNewlineIndex = text.lastIndexOf("\n");
        const startIndexOfLastLineOfAddedText = lastNewlineIndex + 1;

        return text.substring(startIndexOfLastLineOfAddedText);
    }
}