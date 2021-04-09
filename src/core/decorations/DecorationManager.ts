import * as vscode from "vscode";
import { ArrayMap } from "../../shared/utils/ArrayMap";
import { ASTNodeCollecter } from "../ast/visitors/ASTNodeCollecter";
import { InteractiveLatex } from "../InteractiveLatex";
import { VisualisationModel } from "../visualisations/VisualisationModel";
import { textDecorations } from "./text-decorations";

interface ModelWithEditor {
    model: VisualisationModel;
    editor: vscode.TextEditor;
}

export class DecorationManager {
    private ilatex: InteractiveLatex;

    private onRedecorateEditorsEventEmitter: vscode.EventEmitter<void>;

    private codeLensProviderDisposable: vscode.Disposable;
    private redecorationTriggerEventsObserverDisposables: vscode.Disposable[];

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.onRedecorateEditorsEventEmitter = new vscode.EventEmitter<void>();

        this.codeLensProviderDisposable = this.createCodeLensesProvider();
        this.redecorationTriggerEventsObserverDisposables = [];
        
        this.startObservingEventsThatTriggerRedecoration();
    }

    dispose(): void {
        this.codeLensProviderDisposable.dispose();
        this.stopObservingEventsThatTriggerRedecoration();

        this.removeVisualisationDecorationsFromVisibleEditors();
    }

    private createCodeLensesProvider(): vscode.Disposable {
        return vscode.languages.registerCodeLensProvider(
            {
                scheme: "file",
                language: "latex"
            },
            {
                provideCodeLenses: (document) => this.computeCodeLensesForDocument(document),
                onDidChangeCodeLenses: this.onRedecorateEditorsEventEmitter.event
            }
        );
    }

    private computeCodeLensesForDocument(document: vscode.TextDocument): vscode.CodeLens[] {
        // If visualisations are not enabled, do not provide any code lens
        if (!this.ilatex.options.enableVisualisations) {
            return [];
        }

        return this.ilatex.visualisationModelManager.models
            .filter(model => model.sourceFile.isRepresentedByDocument(document) && !model.metadata.available)
            .map(model => new vscode.CodeLens(model.astNode.range.asVscodeRange, {
                title: "iLaTeX is out-of-sync with this piece of code. Click to recompile the document and recompute code visualisations.",
                command: "ilatex.recompile"
            }));
    }

    private mapVisibleEditorsToVisualisations(models: VisualisationModel[]): ArrayMap<vscode.TextEditor, VisualisationModel> {
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
        // If visualisations are not enabled, do not decorate any editor
        if (!this.ilatex.options.enableVisualisations) {
            return;
        }

        // Individual AST of visualisations should be decorated for debug purposes only
        // const astNodeCollecter = new ASTNodeCollecter();
        // models.forEach(model => model.astNode.syncVisitWith(astNodeCollecter));

        // editor.setDecorations(textDecorations.visualisationAstNode, astNodeCollecter.nodes.map(node => {
        //     const start = node.range.from;
        //     const end = node.range.to;

        //     const defaultOptions = { color: "rgba(255, 20, 20, 0.75)" };
        //     let renderOptions = start.initialColumn + start.shift.columns < 0 || end.initialColumn + end.shift.columns < 0
        //         ? {
        //             before: { ...defaultOptions, contentText: `(L ${start.line} C ${start.initialColumn + start.shift.columns})` },
        //             after: { ...defaultOptions, contentText: `(L ${end.line} C${end.initialColumn + end.shift.columns})|` }
        //         }
        //         : { after: { ...defaultOptions, contentText: `|` } };

        //     return {
        //         range: node.range.asVscodeRange,
        //         renderOptions: renderOptions,
        //         hoverMessage: `${node.type} — ${node.range}`
        //     };
        // }));        

        // Available visualisations should be decorated for debug purposes only
        const codeRangesOfAvailableVisualisations = models
            .filter(model => model.metadata.available)
            .map(model => model.astNode.range.asVscodeRange);
        editor.setDecorations(textDecorations.availableVisualisableCode, codeRangesOfAvailableVisualisations);

        const codeRangesOfUnavailableVisualisations = models
            .filter(model => !model.metadata.available)
            .map(model => model.astNode.range.asVscodeRange);
        editor.setDecorations(textDecorations.unavailableVisualisableCode, codeRangesOfUnavailableVisualisations);
    }

    private redecorateVisibleEditorsWithVisualisations(models: VisualisationModel[]): void {
        const visibleEditorsToModels = this.mapVisibleEditorsToVisualisations(models);

        // For each editor, redecorate it using the models located in the source file it displays
        for (let [editor, models] of visibleEditorsToModels.entries) {
            this.redecorateEditorWithVisualisations(editor, models);
        }

        this.onRedecorateEditorsEventEmitter.fire();
    }

    redecorateVisibleEditors(): void {
        this.redecorateVisibleEditorsWithVisualisations(this.ilatex.visualisationModelManager.models);
    }

    private removeVisualisationDecorationsFromVisibleEditors(): void {
        // Redecorate each visible editor as if there was no model
        // (to remove every existing visualisable code decorations)
        for (let editor of vscode.window.visibleTextEditors) {
            this.redecorateEditorWithVisualisations(editor, []);
        }
    }

    private startObservingEventsThatTriggerRedecoration(): void {
        this.redecorationTriggerEventsObserverDisposables.push(
            this.ilatex.visualisationModelManager.modelMetadataChangeEventEmitter.event(
                async model => this.redecorateVisibleEditors()
            ),

            this.ilatex.visualisationModelManager.modelContentChangeEventEmitter.event(
                async model => this.redecorateVisibleEditors()
            ),

            this.ilatex.visualisationModelManager.modelChangeEventEmitter.event(
                async model => this.redecorateVisibleEditors()
            ),
        );
    }

    private stopObservingEventsThatTriggerRedecoration(): void {
        for (let disposable of this.redecorationTriggerEventsObserverDisposables) {
            disposable.dispose();
        }
    }
}