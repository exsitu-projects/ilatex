import * as vscode from "vscode";
import { StringUtils } from "../../shared/utils/StringUtils";
import { SourceFile } from "./SourceFile";
import { SourceFilePosition } from "./SourceFilePosition";
import { SourceFileRange } from "./SourceFileRange";

export interface EditableSection {
    name: string;
    range: SourceFileRange;
}

interface EditableSectionData {
    initialRange: SourceFileRange;
    initialContent: string;    

    currentRange: SourceFileRange;
    currentContent: string;
}

export class TransientSourceFileEditor {
    private sourceFile: SourceFile;

    private sortedEditableSections: EditableSection[];
    private sortedEditableSectionNames: string[];
    private editableSectionNamesToData: Map<string, EditableSectionData>;

    private skipTemporaryEditsIfSourceFileIsNotVisible: boolean;

    constructor(
        sourceFile: SourceFile,
        sortedEditableSections: EditableSection[],
        skipTemporaryEditsIfSourceFileIsNotVisible: boolean = true
    ) {
        this.sourceFile = sourceFile;

        this.sortedEditableSections = sortedEditableSections;
        this.sortedEditableSectionNames = sortedEditableSections.map(section => section.name);
        this.editableSectionNamesToData = new Map();

        this.skipTemporaryEditsIfSourceFileIsNotVisible = skipTemporaryEditsIfSourceFileIsNotVisible;
    }

    get shouldSkipTemporaryEdits(): boolean {
        return this.skipTemporaryEditsIfSourceFileIsNotVisible
            && !this.sourceFile.isOpenInVisibleEditor;
    }

    async init(): Promise<void> {
        for (let editableSection of this.sortedEditableSections) {
            const content = await this.sourceFile.getContent(editableSection.range);
            this.editableSectionNamesToData.set(
                editableSection.name,
                {
                    initialRange: editableSection.range,
                    initialContent: content,    
                
                    currentRange: editableSection.range,
                    currentContent: content
                }
            );
        }
    }

    async replaceSectionContent(sectionName: string, newContent: string): Promise<void> {
        const sectionData = this.editableSectionNamesToData.get(sectionName);
        if (!sectionData) {
            console.warn(`The content of this transient editor cannot be replaced: there is no editable section named "${sectionName}".`);
            return;
        }

        // In some cases, skip temporary section edits
        // This enables to avoid giving focus to an editor when temporary edits are performed
        // (VS Code workspace edits are not an option here, as they do not offer control on undo stops)
        if (!this.shouldSkipTemporaryEdits) {
            this.sourceFile.ignoreChanges = true;

            const editor = await this.sourceFile.getOrOpenInEditor();
            await editor.edit(
                editBuilder => editBuilder.replace(sectionData.currentRange.asVscodeRange, newContent),
                { undoStopBefore: false, undoStopAfter: false}
            );
    
            this.sourceFile.ignoreChanges = false;
        }

        this.shiftSectionRangesBeforeReplacementInSection(sectionName, newContent);
        sectionData.currentContent = newContent;
    }

    private shiftSectionRangesBeforeReplacementInSection(sectionName: string, newContent: string): void {
        const editedSectionData = this.editableSectionNamesToData.get(sectionName)!;
        const editedSectionRange = editedSectionData.currentRange;
        const oldContent = editedSectionData.currentContent;
        
        const nbLinesOfOldContent = StringUtils.countLinesOf(oldContent);
        const nbLinesOfNewContent = StringUtils.countLinesOf(newContent);
        const lineDifference = nbLinesOfNewContent - nbLinesOfOldContent;

        const lengthOfOldContentLastLine = StringUtils.lastLineOf(oldContent).length;
        const lengthOfNewContentLastLine = StringUtils.lastLineOf(newContent).length;
        const columnDifference = lengthOfNewContentLastLine - lengthOfOldContentLastLine;

        // Shift the ranges of every section whose range comes after the range edited section
        const indexOfEditedSectionName = this.sortedEditableSectionNames.indexOf(sectionName);
        const sectionDataAfterEditedSection = this.sortedEditableSectionNames
            .slice(indexOfEditedSectionName)
            .map(name => this.editableSectionNamesToData.get(name)!);
        
        for (let sectionData of sectionDataAfterEditedSection) {
            const from = sectionData.currentRange.from;
            const to = sectionData.currentRange.to;

            sectionData.currentRange = new SourceFileRange(
                new SourceFilePosition(
                    from.line + lineDifference,
                    from.line === editedSectionRange.to.line
                        ? from.column + columnDifference
                        : from.column
                ),
                new SourceFilePosition(
                    to.line + lineDifference,
                    to.line === editedSectionRange.to.line
                        ? to.column + columnDifference
                        : to.column
                )
            );
        }

        // Finally, shift the range of the edited section
        editedSectionData.currentRange = new SourceFileRange(
            editedSectionRange.from,
            new SourceFilePosition(
                editedSectionRange.to.line + (nbLinesOfNewContent - nbLinesOfOldContent),
                editedSectionRange.to.column + (lengthOfNewContentLastLine - lengthOfOldContentLastLine),
            )
        );
    }

    async applyChange(): Promise<void> {
        const reverseSortedSectionData = this.sortedEditableSectionNames
            .reverse()
            .map(name => this.editableSectionNamesToData.get(name)!);

        // First, if temporary edits have not been not skipped, replace the current content by the initial content
        // This is required to ensure the change that will be processed by the source file and its AST
        // is performed on the same content than before the very first transient edit
        // (without this trick, if the final new content is long enough, it might produce undesired accross-node changes!)
        if (!this.shouldSkipTemporaryEdits) {
            this.sourceFile.ignoreChanges = true;

            const editor = new vscode.WorkspaceEdit();
            for (let sectionData of reverseSortedSectionData) {
                editor.replace(
                    this.sourceFile.uri,
                    sectionData.currentRange.asVscodeRange,
                    sectionData.initialContent
                );
            }
    
            await vscode.workspace.applyEdit(editor);
    
            this.sourceFile.ignoreChanges = false;
        }


        // Then, replace the initial content by the last new content WITHOUT making the source file ignore the change
        await this.sourceFile.applyEdits(...reverseSortedSectionData.map(sectionData => 
            vscode.TextEdit.replace(sectionData.initialRange.asVscodeRange, sectionData.currentContent)
        ));        
    }
}