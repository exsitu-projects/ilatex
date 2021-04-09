import * as vscode from "vscode";
import { PDFManager } from "./pdf/PDFManager";
import { WebviewManager } from "./webview/WebviewManager";
import { VisualisationModelManager } from "./visualisations/VisualisationModelManager";
import { DecorationManager } from "./decorations/DecorationManager";
import { SourceFileManager } from "./source-files/SourceFileManager";
import { CodeMappingManager } from "./code-mappings/CodeMappingManager";
import { SourceFile } from "./source-files/SourceFile";
import { LogFileManager } from "./logs/LogFileManager";

export interface InteractiveLatexOptions {
    enableVisualisations: boolean;
}

export class InteractiveLatex {
    readonly mainSourceFileUri: vscode.Uri;

    readonly options: InteractiveLatexOptions;

    readonly logFileManager: LogFileManager;
    readonly sourceFileManager: SourceFileManager;
    readonly codeMappingManager: CodeMappingManager;
    readonly pdfManager: PDFManager;
    readonly webviewManager: WebviewManager;
    readonly visualisationModelManager: VisualisationModelManager;
    readonly decorationManager: DecorationManager;

    // private sourceFileSaveObserverDisposable: vscode.Disposable;
    private fileSaveObserverDisposable: vscode.Disposable;

    private constructor(
        mainSourceFileUri: vscode.Uri,
        webviewPanel: vscode.WebviewPanel,
        options: InteractiveLatexOptions
    ) {
        this.mainSourceFileUri = mainSourceFileUri;

        this.options = options;

        this.logFileManager = new LogFileManager(this);
        this.sourceFileManager = new SourceFileManager(this);
        this.codeMappingManager = new CodeMappingManager(this);
        this.pdfManager = new PDFManager(this);
        this.webviewManager = new WebviewManager(this, webviewPanel);
        this.visualisationModelManager = new VisualisationModelManager(this);
        this.decorationManager = new DecorationManager(this);
        
        // this.sourceFileSaveObserverDisposable =
        //     this.sourceFileManager.sourceFileSaveEventEmitter.event(
        //         async sourceFile => await this.onSourceFileSave(sourceFile)
        //     );

        this.fileSaveObserverDisposable = vscode.workspace.onDidSaveTextDocument(envent => {
            this.recompileAndUpdate();
        });

        this.logFileManager.logCoreEvent({ event: "ilatex-started" });
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
        
        // Dispose the log file manager last in case it needs to be used to log an error
        this.logFileManager.logCoreEvent({ event: "ilatex-disposed" });
        this.logFileManager.dispose();

        // this.sourceFileSaveObserverDisposable.dispose();
        this.fileSaveObserverDisposable.dispose();
    }

    private async onSourceFileSave(sourceFile: SourceFile): Promise<void> {
        await this.recompileAndUpdate();
    }

    // TODO: use a queue
    // Recompile the document and update everything
    async recompileAndUpdate(): Promise<void> {
        try {
            // 1. Ensure the global options are up-to-date in the webview
            this.webviewManager.sendNewGlobalOptions();

            // 3. Recompile the PDF and update it in the webview
            await this.pdfManager.recompilePDFAndUpdateWebview();

            // Only perform the next steps if visualisations are globally enabled
            // TODO: handle this somewhere else?
            if (this.options.enableVisualisations) {
                // 3. Update the code mappings from the new code mapping file
                this.codeMappingManager.updateCodeMappingsFromLatexGeneratedFile();

                // 4. Update the source files
                // TODO: use another way to update source files (not just from code mappings...)
                await this.sourceFileManager.updateSourceFilesFromCodeMappings();

                // 5. Update the visualisations (models + views in the webview)
                await this.visualisationModelManager.extractNewModels();

                // 6. Update the decorations in the editor
                this.decorationManager.redecorateVisibleEditors();
            }
        }
        catch (error) {
            console.error("An unexpected error occured during the re-compilation/update phase of iLaTeX:", error);
            this.logFileManager.logError({ event: "unexpected-recompilation-error" });
        }

        this.logFileManager.logCoreEvent({ event: "ilatex-updated" });
    }

    static fromMainLatexDocument(
        mainLatexDocument: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        options: InteractiveLatexOptions
    ): Promise<InteractiveLatex> {
        return new Promise(async (resolve, reject) => {
            const ilatex = new InteractiveLatex(mainLatexDocument.uri, webviewPanel, options);
            await ilatex.init();

            resolve(ilatex);
        });
    }
}