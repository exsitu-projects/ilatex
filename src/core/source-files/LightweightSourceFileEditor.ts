import { StringUtils } from "../../shared/utils/StringUtils";
import { SourceFile } from "./SourceFile";
import { SourceFilePosition, SourceFilePositionShift } from "./SourceFilePosition";
import { SourceFileRange } from "./SourceFileRange";

export class LightweightSourceFileEditor {
    private sourceFile: SourceFile;

    private initialRange: SourceFileRange;
    private initialContent: string;    

    private currentRange: SourceFileRange;
    private currentContent: string;

    constructor(sourceFile: SourceFile, range: SourceFileRange) {
        this.sourceFile = sourceFile;

        this.initialRange = range;
        this.initialContent = "";

        this.currentRange = range;
        this.currentContent = "";
    }

    async init(): Promise<void> {
        this.currentContent = await this.sourceFile.getContent(this.currentRange);
        this.initialContent = this.currentContent;
    }

    private getPostReplacementRangeFor(newContent: string): SourceFileRange {
        const nbLinesOfOldContent = StringUtils.countLinesOf(this.currentContent);
        const nbLinesOfNewContent = StringUtils.countLinesOf(newContent);

        const lengthOfOldContentLastLine = StringUtils.lastLineOf(this.currentContent).length;
        const lengthOfNewContentLastLine = StringUtils.lastLineOf(newContent).length;

        return new SourceFileRange(
            this.currentRange.from,
            new SourceFilePosition(
                this.currentRange.to.line + (nbLinesOfNewContent - nbLinesOfOldContent),
                this.currentRange.to.column + (lengthOfNewContentLastLine - lengthOfOldContentLastLine),
            )
        );
    }

    async replaceContentWith(newContent: string): Promise<void> {
        this.sourceFile.ignoreChanges = true;

        const editor = await this.sourceFile.getOrOpenInEditor();
        await editor.edit(
            editBuilder => editBuilder.replace(this.currentRange.asVscodeRange, newContent),
            { undoStopBefore: false, undoStopAfter: false}
        );

        this.sourceFile.ignoreChanges = false;

        this.currentRange = this.getPostReplacementRangeFor(newContent);
        this.currentContent = newContent;
    }

    async applyChange(): Promise<void> {
        // First, replace the current content by the initial content
        // This is required to ensure the change that will be processed by the source file and its AST
        // is performed on the same content than before the very first lightweight edit
        // (without this trick, if the final new content is long enough, it might produce undesired accross-node changes!)
        this.sourceFile.ignoreChanges = true;

        const editor = await this.sourceFile.getOrOpenInEditor();
        await editor.edit(
            editBuilder => editBuilder.replace(this.currentRange.asVscodeRange, this.initialContent),
            { undoStopBefore: false, undoStopAfter: false}
        );

        // Then, replace the initial content by the last new content WITHOUT making the source file ignore the change
        this.sourceFile.ignoreChanges = false;
        
        await this.sourceFile.makeAtomicChange(
            editBuilder => editBuilder.replace(this.initialRange.asVscodeRange, this.currentContent)
        );
    }
}