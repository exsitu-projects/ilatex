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

    private sourceFileChangeObserverDisposable: vscode.Disposable;
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

        this.sourceFileChangeObserverDisposable =
            this.sourceFileManager.sourceFileChangeEventEmitter.event(
                async sourceFile => await this.onSourceFileChange(sourceFile)
            );
        
        this.sourceFileSaveObserverDisposable =
            this.sourceFileManager.sourceFileSaveEventEmitter.event(
                async sourceFile => await this.onSourceFileSave(sourceFile)
            );
    }

    private async init(): Promise<void> {
        await this.recompileAndUpdate();

        // Once visualisations have been created, start to decorate editors
        this.decorationManager.redecorateVisibleEditorsWithCurrentVisualisations();
    }

    dispose(): void {
        console.warn(`iLaTeX instance for root document ${this.mainSourceFileUri.path} is about to be disposed...`);

        this.codeMappingManager.dispose();
        this.pdfManager.dispose();
        this.webviewManager.dispose();
        this.visualisationModelManager.dispose();
        this.decorationManager.dispose();

        this.sourceFileChangeObserverDisposable.dispose();
        this.sourceFileSaveObserverDisposable.dispose();
    }

    private async onSourceFileChange(sourceFile: SourceFile): Promise<void> {
        this.decorationManager.redecorateVisibleEditorsWithCurrentVisualisations();
        // TODO: notify the visualisations/webview manager here
    }

    private async onSourceFileSave(sourceFile: SourceFile): Promise<void> {
        await this.recompileAndUpdate();
    }

    // Recompile the document and update everything
    async recompileAndUpdate(): Promise<void> {
        // 1. Recompile the PDF and update it in the webview
        await this.pdfManager.recompilePDFAndUpdateWebview();
        
        // 2. Update the code mappings from the new code mapping file
        this.codeMappingManager.updateCodeMappingsFromLatexGeneratedFile();

        // 3. Update the source files
        // TODO: use another way to update source files (not just from code mappings...)
        this.sourceFileManager.updateSourceFilesFromCodeMappings();

        // 4. Update the visualisations (models + views in the webview)
        this.visualisationModelManager.extractNewModelsAndUpdateWebview();

        // 5. Update the decorations in the editor
        this.decorationManager.redecorateVisibleEditorsWithCurrentVisualisations();
    }

    static fromMainLatexDocument(mainLatexDocument: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<InteractiveLatex> {
        return new Promise(async (resolve, reject) => {
            const ilatex = new InteractiveLatex(mainLatexDocument.uri, webviewPanel);
            await ilatex.init();

            resolve(ilatex);
        });
    }
}