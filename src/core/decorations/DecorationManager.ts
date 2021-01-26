import * as vscode from "vscode";
import { ArrayMap } from "../../shared/utils/ArrayMap";
import { InteractiveLatex } from "../InteractiveLaTeX";
import { VisualisationModel } from "../visualisations/VisualisationModel";
import { decorationTypes } from "./decoration-types";

interface ModelWithEditor {
    model: VisualisationModel;
    editor: vscode.TextEditor;
}

export class DecorationManager {
    private ilatex: InteractiveLatex;

    private textFileChangeDisposable: vscode.Disposable;
    private textFileSaveDisposable: vscode.Disposable;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.textFileChangeDisposable = vscode.workspace.onDidChangeTextDocument(
            async (event) => await this.onDocumentChange(event)
        );
        this.textFileSaveDisposable = vscode.window.onDidChangeVisibleTextEditors(
            async (event) => await this.onVisibleEditorsChange(event)
        );
    }

    dispose(): void {
        this.textFileChangeDisposable.dispose();
        this.textFileSaveDisposable.dispose();
    }

    private mapVisibleEditorsToVisualisationModels(models: VisualisationModel[]): ArrayMap<vscode.TextEditor, VisualisationModel> {
        // Map each visible editor to 0+ visualisation models
        const visibleEditors = vscode.window.visibleTextEditors;
        const modelsWithVisibleEditors: ModelWithEditor[] = models
            .filter(model => model.sourceFile.editor !== null && visibleEditors.includes(model.sourceFile.editor))
            .map(model => {
                return {
                    model: model,
                    editor: model.sourceFile.editor as vscode.TextEditor
                };
            });

        const visibleEditorsToModels = new ArrayMap<vscode.TextEditor, VisualisationModel>();
        for (let { model, editor } of modelsWithVisibleEditors) {
            visibleEditorsToModels.add(editor!, model);
        }

        return visibleEditorsToModels;
    }

    private redecorate(editor: vscode.TextEditor, models: VisualisationModel[]): void {
        const visualisableCodeRanges: vscode.Range[] = models.map(model => model.codeRange);
        editor.setDecorations(decorationTypes.visualisableCode, visualisableCodeRanges);

        // console.log(`Editor of document "${editor.document.fileName}" has been redecorted.`);
    }

    private redecorateVisibleEditorsWith(models: VisualisationModel[]): void {
        const visibleEditorsToModels = this.mapVisibleEditorsToVisualisationModels(models);

        // For each editor, redecorate it using the models located in the source file it displays
        for (let [editor, models] of visibleEditorsToModels.entries) {
            this.redecorate(editor, models);
        } 
    }

    redecorateVisibleEditorsWithCurrentVisualisations(): void {
        this.redecorateVisibleEditorsWith(
            this.ilatex.visualisationModelManager.models
        );
    }

    private async onDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        this.redecorateVisibleEditorsWithCurrentVisualisations();
    }

    private async onVisibleEditorsChange(visibleEditors: vscode.TextEditor[]): Promise<void> {
        this.redecorateVisibleEditorsWithCurrentVisualisations();
    }
}