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

    private onRedecorateEventEmitter: vscode.EventEmitter<void>;
    private codeLensProviderDisposable: vscode.Disposable;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.onRedecorateEventEmitter = new vscode.EventEmitter<void>();

        const self = this;
        this.codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
            { scheme: "file", language:"latex" },
            {
                provideCodeLenses(document: vscode.TextDocument) {
                    return self.ilatex.visualisationModelManager.models
                        .filter(model => model.sourceFile.absolutePath === document.uri.path && model.hasBeenManuallyEdited)
                        .map(model =>  new vscode.CodeLens(model.codeRange, {
                            title: "iLaTeX is out-of-sync with this piece of code. Click to recompile the document and fix the problem.",
                            command: "ilatex.recompile"
                        }));
                },

                onDidChangeCodeLenses: self.onRedecorateEventEmitter.event
            }
        );
    }

    dispose(): void {
        this.codeLensProviderDisposable.dispose();
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

    private redecorateEditorWithVisualisations(editor: vscode.TextEditor, models: VisualisationModel[]): void {
        const visualisableCodeRanges: vscode.Range[] = models
            .filter(model => !model.hasBeenManuallyEdited)
            .map(model => model.codeRange);
        editor.setDecorations(decorationTypes.visualisableCode, visualisableCodeRanges);
        
        const manuallyEditedVisualisableCodeRanges: vscode.Range[] = models
            .filter(model => model.hasBeenManuallyEdited)
            .map(model => model.codeRange);
        editor.setDecorations(decorationTypes.manuallyEditedVisualisableCode, manuallyEditedVisualisableCodeRanges);

        // console.log("Redecorated the following ranges:", visualisableCodeRanges);
    }

    private redecorateVisibleEditorsWithVisualisations(models: VisualisationModel[]): void {
        const visibleEditorsToModels = this.mapVisibleEditorsToVisualisationModels(models);

        // For each editor, redecorate it using the models located in the source file it displays
        for (let [editor, models] of visibleEditorsToModels.entries) {
            this.redecorateEditorWithVisualisations(editor, models);
        }

        this.onRedecorateEventEmitter.fire();
    }

    redecorateVisibleEditorsWithCurrentVisualisations(): void {
        this.redecorateVisibleEditorsWithVisualisations(
            this.ilatex.visualisationModelManager.models
        );
    }
}