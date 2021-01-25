import * as vscode from "vscode";
import { PDFManager } from "./pdf/PDFManager";
import { WebviewManager } from "./webview/WebviewManager";
import { VisualisationModelManager } from "./visualisations/VisualisationModelManager";
import { CodeMappingManager } from "./mappings/CodeMappingManager";


export class InteractiveLatex {
    readonly mainSourceFileUri: vscode.Uri;
    private webviewPanel: vscode.WebviewPanel;

    readonly codeMappingManager: CodeMappingManager;
    readonly pdfManager: PDFManager;
    readonly webviewManager: WebviewManager;
    readonly visualisationModelManager: VisualisationModelManager;

    private textFileChangeDisposable: vscode.Disposable;
    private textFileSaveDisposable: vscode.Disposable;

    private constructor(mainSourceFileUri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
        this.mainSourceFileUri = mainSourceFileUri;
        this.webviewPanel = webviewPanel;

        this.codeMappingManager = new CodeMappingManager(this);
        this.pdfManager = new PDFManager(this);
        this.webviewManager = new WebviewManager(this, webviewPanel);
        this.visualisationModelManager = new VisualisationModelManager(this);

        // Register observers for changes and saves in any text document
        // Every time a source file containing code mappings is MODIFIED or SAVED,
        // the 'dirty' status of the underlying document may change
        // Since this status is used to determine whether visualisations can be made
        // available to the users or not (in the webview), such changes must be tracked
        // in order to update the webview accordingly
        this.textFileChangeDisposable = vscode.workspace.onDidChangeTextDocument(
            async (event) => await this.onSourceFileChange(event)
        );
        this.textFileSaveDisposable = vscode.workspace.onDidSaveTextDocument(
            async (event) => await this.onSourceFileSave(event)
        );
    }

    private async init(): Promise<void> {
        await this.updatePDFAndVisualisations();
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

        this.textFileChangeDisposable.dispose();
        this.textFileSaveDisposable.dispose();
    }

    // Visualisations should be available as long as no source file with code mappings is dirty
    updateVisualisationsAvailiability(): void {
        console.log("enabled", !this.codeMappingManager.someSourceFileIsDirty);
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
            // if (event.contentChanges.some(change =>
            //     this.visualisationModelManager.hasModelAbleToHandleChangeIn(modifiedFileAbsolutePath, change.range))
            // ) {
                // Do something
            // }

            console.log("Update availability after change");
            this.updateVisualisationsAvailiability();
        }
    }

    private onSourceFileSave(document: vscode.TextDocument): void {
        const savedFileAbsolutePath = document.uri.path;
        const savedSourceFile = this.codeMappingManager.allSourceFiles.find(file => file.absolutePath === savedFileAbsolutePath);

        if (!savedSourceFile) {
            return;
        }
        else {
            console.log("Update availability after save");
            this.updateVisualisationsAvailiability();
        }        
    }

    // Generate a new PDF, extract new visualisations,
    // and update the webview with both.
    // This global update is a multi-steps process:
    // 1. the whole document must be recompiled;
    // 2. the new PDF must be sent to the webview;
    // 3. the new code mapping files must be read;
    // 4. new mappings, source files, ASTs and visualisations models
    //    must be generated from scratch;
    // 5. the new visualisation models must generate new content
    //    that must be sent to the webview.
    async updatePDFAndVisualisations(): Promise<void> {
        // Steps 1 and 2
        await this.pdfManager.buildPDFAndUpdateWebview();
        
        // Step 3 and 4
        await this.codeMappingManager.updateMappingsFromLatexGeneratedFile();

        // Step 4 and 5
        this.visualisationModelManager.extractNewModelsAndUpdateWebview();
    }

    static createFromMainLatexDocument(mainLatexDocument: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<InteractiveLatex> {
        return new Promise(async (resolve, reject) => {
            const ilatex = new InteractiveLatex(mainLatexDocument.uri, webviewPanel);
            await ilatex.init();

            resolve(ilatex);
        });
    }
}