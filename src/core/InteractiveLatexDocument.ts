import * as vscode from "vscode";
import { LatexCompilerManager } from "./latex-compiler/LatexCompilerManager";
import { WebviewManager } from "./webview/WebviewManager";
import { TransitionalModelManager } from "./transitionals/TransitionalModelManager";
import { DecorationManager } from "./decorations/DecorationManager";
import { SourceFileManager } from "./source-files/SourceFileManager";
import { CodeMappingManager } from "./code-mappings/CodeMappingManager";
import { LogFileManager } from "./logs/LogFileManager";
import { TaskDebouncer } from "../shared/tasks/TaskDebouncer";

export interface InteractiveLatexDocumentOptions {
    // Globally enable or disable transitionals
    enableTransitionals: boolean;

    // Local log files
    enableLocalLogging: boolean;
    localLogFileType: "regular" | "hidden";

    // Centralised log files
    enableCentralisedLogging: boolean;
    centralisedLoggingDirectoryPath: string;

    // Extra options for latexmk (the tool used to compile LaTeX documents)
    extraLatexmkOptions: string;
}

export class InteractiveLatexDocument {
    readonly mainSourceFileUri: vscode.Uri;

    readonly options: InteractiveLatexDocumentOptions;

    readonly logFileManager: LogFileManager;
    readonly sourceFileManager: SourceFileManager;
    readonly codeMappingManager: CodeMappingManager;
    readonly latexCompilerManager: LatexCompilerManager;
    readonly webviewManager: WebviewManager;
    readonly transitionalModelManager: TransitionalModelManager;
    readonly decorationManager: DecorationManager;

    private updateDebouncer: TaskDebouncer;
    private isUpdating: boolean;

    private fileSaveObserverDisposable: vscode.Disposable;

    private constructor(
        mainSourceFileUri: vscode.Uri,
        webviewPanel: vscode.WebviewPanel,
        options: InteractiveLatexDocumentOptions
    ) {
        this.mainSourceFileUri = mainSourceFileUri;

        this.options = options;

        this.logFileManager = new LogFileManager(this);
        this.sourceFileManager = new SourceFileManager(this);
        this.codeMappingManager = new CodeMappingManager(this);
        this.latexCompilerManager = new LatexCompilerManager(this);
        this.webviewManager = new WebviewManager(this, webviewPanel);
        this.transitionalModelManager = new TransitionalModelManager(this);
        this.decorationManager = new DecorationManager(this);

        this.updateDebouncer = new TaskDebouncer(5, error => this.processUpdateError(error));
        this.isUpdating = false;
        
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
        this.latexCompilerManager.dispose();
        this.webviewManager.dispose();
        this.transitionalModelManager.dispose();
        this.decorationManager.dispose();
        
        // Dispose the log file manager last in case it needs to be used to log an error
        this.logFileManager.logCoreEvent({ event: "ilatex-disposed" });
        this.logFileManager.dispose();

        this.fileSaveObserverDisposable.dispose();
    }

    // Recompile the document and update everything
    recompileAndUpdate(ignoreIfCurrentlyUpdating: boolean = true): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isUpdating && ignoreIfCurrentlyUpdating){
                resolve();
                return;
            }

            this.updateDebouncer.add(async () => {
                this.isUpdating = true;
    
                // 1. Ensure the global options are up-to-date in the webview
                this.webviewManager.sendNewGlobalOptions();
    
                // 2. Recompile the PDF
                await this.latexCompilerManager.recompilePDF();

                // 3. Send the new PDF to the webview
                this.webviewManager.sendNewPDF();
    
                // 4. Update the code mappings from the new code mapping file
                this.codeMappingManager.updateCodeMappingsFromLatexGeneratedFile();

                // 5. Update the source files
                // TODO: use another way to update source files (not just from code mappings...)
                await this.sourceFileManager.updateSourceFilesFromCodeMappings();

                // 6. Update the transitionals
                // This includes generating new models, which will send content and metadata
                // to the webview, where the views can be created on demand.
                await this.transitionalModelManager.extractNewModels();

                // 7. Update the decorations in the code editor
                this.decorationManager.redecorateVisibleEditors();
                
                this.logFileManager.logCoreEvent({ event: "ilatex-updated" });
                this.isUpdating = false;

                resolve();
            });
        });
    }

    private processUpdateError(error: any): void {
        console.error("An unexpected error occured during the re-compilation/update phase of iLaTeX:", error);
        this.logFileManager.logError({ event: "unexpected-recompilation-error" });

        this.isUpdating = false;
    }

    static fromMainLatexFileAt(
        uri: vscode.Uri,
        webviewPanel: vscode.WebviewPanel,
        options: InteractiveLatexDocumentOptions
    ): Promise<InteractiveLatexDocument> {
        return new Promise(async (resolve, reject) => {
            try {
                const ilatex = new InteractiveLatexDocument(uri, webviewPanel, options);
                await ilatex.init();
                resolve(ilatex);
            }
            catch (error) {
                reject(error);
            }
        });
    }
}