import * as vscode from "vscode";
import { PDFManager } from "./pdf/PDFManager";
import { WebviewManager } from "./webview/WebviewManager";
import { VisualisationModelManager } from "./visualisations/VisualisationModelManager";
import { DecorationManager } from "./decorations/DecorationManager";
import { SourceFileManager } from "./source-files/SourceFileManager";
import { CodeMappingManager } from "./code-mappings/CodeMappingManager";
import { SourceFile } from "./source-files/SourceFile";


export class InteractiveLatex {
    readonly mainSourceFileUri: vscode.Uri;
    private webviewPanel: vscode.WebviewPanel;

    readonly sourceFileManager: SourceFileManager;
    readonly codeMappingManager: CodeMappingManager;
    readonly pdfManager: PDFManager;
    readonly webviewManager: WebviewManager;
    readonly visualisationModelManager: VisualisationModelManager;
    readonly decorationManager: DecorationManager;

    private sourceFileSaveObserverDisposable: vscode.Disposable;

    private constructor(mainSourceFileUri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
        this.mainSourceFileUri = mainSourceFileUri;
        this.webviewPanel = webviewPanel;

        this.sourceFileManager = new SourceFileManager(this);
        this.codeMappingManager = new CodeMappingManager(this);
        this.pdfManager = new PDFManager(this);
        this.webviewManager = new WebviewManager(this, webviewPanel);
        this.visualisationModelManager = new VisualisationModelManager(this);
        this.decorationManager = new DecorationManager(this);
        
        this.sourceFileSaveObserverDisposable =
            this.sourceFileManager.sourceFileSaveEventEmitter.event(
                async sourceFile => await this.onSourceFileSave(sourceFile)
            );
    }

    private async init(): Promise<void> {
        await this.recompileAndUpdate();
    }

    dispose(): void {
        this.codeMappingManager.dispose();
        this.pdfManager.dispose();
        this.webviewManager.dispose();
        this.visualisationModelManager.dispose();
        this.decorationManager.dispose();

        this.sourceFileSaveObserverDisposable.dispose();
    }

    private async onSourceFileSave(sourceFile: SourceFile): Promise<void> {
        await this.recompileAndUpdate();
    }

    // TODO: use a queue
    // Recompile the document and update everything
    async recompileAndUpdate(): Promise<void> {
        // 1. Recompile the PDF and update it in the webview
        await this.pdfManager.recompilePDFAndUpdateWebview();
        
        // 2. Update the code mappings from the new code mapping file
        this.codeMappingManager.updateCodeMappingsFromLatexGeneratedFile();

        // 3. Update the source files
        // TODO: use another way to update source files (not just from code mappings...)
        await this.sourceFileManager.updateSourceFilesFromCodeMappings();

        // 4. Update the visualisations (models + views in the webview)
        await this.visualisationModelManager.extractNewModels();
        // this.webviewManager.sendNewContentForAllVisualisations();

        // 5. Update the decorations in the editor
        this.decorationManager.redecorateVisibleEditors();
    }

    static fromMainLatexDocument(mainLatexDocument: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<InteractiveLatex> {
        return new Promise(async (resolve, reject) => {
            const ilatex = new InteractiveLatex(mainLatexDocument.uri, webviewPanel);
            await ilatex.init();

            resolve(ilatex);
        });
    }
}