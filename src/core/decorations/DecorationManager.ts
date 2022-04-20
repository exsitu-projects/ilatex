import * as vscode from "vscode";
import { ArrayMap } from "../../shared/utils/ArrayMap";
import { ASTNodeCollecter } from "../ast/visitors/ASTNodeCollecter";
import { InteractiveLatexDocument } from "../InteractiveLatexDocument";
import { TransitionalModel } from "../transitionals/TransitionalModel";
import { textDecorations } from "./text-decorations";

interface ModelWithEditor {
    model: TransitionalModel;
    editor: vscode.TextEditor;
}

export class DecorationManager {
    private ilatexDocument: InteractiveLatexDocument;

    private onRedecorateEditorsEventEmitter: vscode.EventEmitter<void>;

    private codeLensProviderDisposable: vscode.Disposable;
    private redecorationTriggerEventsObserverDisposables: vscode.Disposable[];

    constructor(ilatexDocument: InteractiveLatexDocument) {
        this.ilatexDocument = ilatexDocument;

        this.onRedecorateEditorsEventEmitter = new vscode.EventEmitter<void>();

        this.codeLensProviderDisposable = this.createCodeLensesProvider();
        this.redecorationTriggerEventsObserverDisposables = [];
        
        this.startObservingEventsThatTriggerRedecoration();
    }

    dispose(): void {
        this.codeLensProviderDisposable.dispose();
        this.stopObservingEventsThatTriggerRedecoration();

        this.removeTransitionalDecorationsFromVisibleEditors();
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
        // If transitionals are not enabled, do not provide any code lens
        if (!this.ilatexDocument.options.enableTransitionals) {
            return [];
        }

        return this.ilatexDocument.transitionalModelManager.models
            .filter(model => model.sourceFile.isRepresentedByDocument(document) && !model.metadata.available)
            .map(model => new vscode.CodeLens(model.astNode.range.asVscodeRange, {
                title: "iLaTeX is out-of-sync with this piece of code. Click to recompile the document and recompute code transitionals.",
                command: "ilatex.recompileDocumentsUsingActiveEditor"
            }));
    }

    private mapVisibleEditorsToTransitionals(models: TransitionalModel[]): ArrayMap<vscode.TextEditor, TransitionalModel> {
        // Map each visible editor to 0+ transitional models
        const visibleEditors = vscode.window.visibleTextEditors;
        const modelsWithVisibleEditors: ModelWithEditor[] = models
            .filter(model => model.sourceFile.isOpenInVisibleEditor)
            .map(model => {
                return {
                    model: model,
                    editor: visibleEditors.find(editor => model.sourceFile.isOpenInEditor(editor))!
                };
            });

        const visibleEditorsToModels = new ArrayMap<vscode.TextEditor, TransitionalModel>();
        for (let { model, editor } of modelsWithVisibleEditors) {
            visibleEditorsToModels.add(editor!, model);
        }

        return visibleEditorsToModels;
    }

    private redecorateEditorWithTransitionals(editor: vscode.TextEditor, models: TransitionalModel[]): void {
        // If transitionals are not enabled, do not decorate any editor
        if (!this.ilatexDocument.options.enableTransitionals) {
            return;
        }

        // Individual AST of transitionals should be decorated for debug purposes only
        // const astNodeCollecter = new ASTNodeCollecter();
        // models.forEach(model => model.astNode.syncVisitWith(astNodeCollecter));

        // editor.setDecorations(textDecorations.transitionalAstNode, astNodeCollecter.nodes.map(node => {
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

        // Available transitionals should be decorated for debug purposes only
        const codeRangesOfAvailableTransitionals = models
            .filter(model => model.metadata.available)
            .map(model => model.astNode.range.asVscodeRange);
        editor.setDecorations(textDecorations.availableTransitionalCode, codeRangesOfAvailableTransitionals);

        const codeRangesOfUnavailableTransitionals = models
            .filter(model => !model.metadata.available)
            .map(model => model.astNode.range.asVscodeRange);
        editor.setDecorations(textDecorations.unavailableTransitionalCode, codeRangesOfUnavailableTransitionals);
    }

    private redecorateVisibleEditorsWithTransitionals(models: TransitionalModel[]): void {
        const visibleEditorsToModels = this.mapVisibleEditorsToTransitionals(models);

        // For each editor, redecorate it using the models located in the source file it displays
        for (let [editor, models] of visibleEditorsToModels.entries) {
            this.redecorateEditorWithTransitionals(editor, models);
        }

        this.onRedecorateEditorsEventEmitter.fire();
    }

    redecorateVisibleEditors(): void {
        this.redecorateVisibleEditorsWithTransitionals(this.ilatexDocument.transitionalModelManager.models);
    }

    private removeTransitionalDecorationsFromVisibleEditors(): void {
        // Redecorate each visible editor as if there was no model
        // (to remove every existing visualisable code decorations)
        for (let editor of vscode.window.visibleTextEditors) {
            this.redecorateEditorWithTransitionals(editor, []);
        }
    }

    private startObservingEventsThatTriggerRedecoration(): void {
        this.redecorationTriggerEventsObserverDisposables.push(
            this.ilatexDocument.transitionalModelManager.modelMetadataChangeEventEmitter.event(
                async model => this.redecorateVisibleEditors()
            ),

            this.ilatexDocument.transitionalModelManager.modelContentChangeEventEmitter.event(
                async model => this.redecorateVisibleEditors()
            ),

            this.ilatexDocument.transitionalModelManager.modelChangeEventEmitter.event(
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