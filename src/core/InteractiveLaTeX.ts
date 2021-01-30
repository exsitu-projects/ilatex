import * as vscode from "vscode";
import { PDFManager } from "./pdf/PDFManager";
import { WebviewManager } from "./webview/WebviewManager";
import { VisualisationModelManager } from "./visualisations/VisualisationModelManager";
import { CodeMappingManager } from "./mappings/CodeMappingManager";
import { DecorationManager } from "./decorations/DecorationManager";


export class InteractiveLatex {
    readonly mainSourceFileUri: vscode.Uri;
    private webviewPanel: vscode.WebviewPanel;

    readonly codeMappingManager: CodeMappingManager;
    readonly pdfManager: PDFManager;
    readonly webviewManager: WebviewManager;
    readonly visualisationModelManager: VisualisationModelManager;
    readonly decorationManager: DecorationManager;

    private textFileChangeDisposable: vscode.Disposable;

    private constructor(mainSourceFileUri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
        this.mainSourceFileUri = mainSourceFileUri;
        this.webviewPanel = webviewPanel;

        this.codeMappingManager = new CodeMappingManager(this);
        this.pdfManager = new PDFManager(this);
        this.webviewManager = new WebviewManager(this, webviewPanel);
        this.visualisationModelManager = new VisualisationModelManager(this);
        this.decorationManager = new DecorationManager(this);

        this.textFileChangeDisposable = vscode.workspace.onDidChangeTextDocument(
            async (event) => await this.onSourceFileChange(event)
        );
    }

    private async init(): Promise<void> {
        await this.updatePDFAndVisualisations();

        // Once visualisations have been created, start to decorate editors
        this.decorationManager.redecorateVisibleEditorsWithCurrentVisualisations();
    }

    // This method will be called by the extension
    // everytime an iLaTeX  instance is to be disposed
    // (e.g. when its webview panel has been closed).
    // It must therefore performs the necessery clean up.
    dispose(): void {
        console.warn(`iLaTeX instance for root document ${this.mainSourceFileUri.path} is about to be disposed...`);

        this.codeMappingManager.dispose();
        this.pdfManager.dispose();
        this.webviewManager.dispose();
        this.visualisationModelManager.dispose();
        this.decorationManager.dispose();

        this.textFileChangeDisposable.dispose();
    }

    // Visualisations should be available as long as no source file with code mappings is dirty
    updateVisualisationsAvailiability(): void {
        this.webviewManager.sendNewVisualisationStatus(
            !this.codeMappingManager.someSourceFileIsDirty
        );
    }

    private onSourceFileChange(event: vscode.TextDocumentChangeEvent): void {
        const modifiedFileAbsolutePath = event.document.uri.path;
        const modifiedSourceFile = this.codeMappingManager.allSourceFiles.find(file => file.absolutePath === modifiedFileAbsolutePath);

        if (!modifiedSourceFile) {
            return;
        }
        else {
            modifiedSourceFile.processFileChange(event);
            this.decorationManager.redecorateVisibleEditorsWithCurrentVisualisations();
            this.updateVisualisationsAvailiability();
        }
    }

    // Generate a new PDF, extract new visualisations, and update the webview with both.
    // This global update is a multi-steps process:
    // 1. the whole document must be recompiled;
    // 2. the new PDF must be sent to the webview;
    // 3. the new code mapping files must be read;
    // 4. new mappings, source files, ASTs and visualisations models
    //    must be generated from scratch;
    // 5. the new visualisation models must generate new content
    //    that must be sent to the webview;
    // 6. the editors must be redecorated.
    async updatePDFAndVisualisations(): Promise<void> {
        // Steps 1 and 2
        await this.pdfManager.buildPDFAndUpdateWebview();
        
        // Step 3 and 4
        await this.codeMappingManager.updateMappingsFromLatexGeneratedFile();

        // Step 4 and 5
        this.visualisationModelManager.extractNewModelsAndUpdateWebview();
        this.updateVisualisationsAvailiability();

        // Step 6
        this.decorationManager.redecorateVisibleEditorsWithCurrentVisualisations();
    }

    static createFromMainLatexDocument(mainLatexDocument: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<InteractiveLatex> {
        return new Promise(async (resolve, reject) => {
            const ilatex = new InteractiveLatex(mainLatexDocument.uri, webviewPanel);
            await ilatex.init();

            resolve(ilatex);
        });
    }
}