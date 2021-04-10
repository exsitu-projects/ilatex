import * as vscode from "vscode";
import * as path from "path";
import { InteractiveLatex, InteractiveLatexOptions } from "./InteractiveLatex";

function createWebview(title: string): vscode.WebviewPanel {
	return vscode.window.createWebviewPanel(
		"ilatex",
		title,
		vscode.ViewColumn.Two,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);
}

export class InteractiveLatexDocumentManager implements vscode.Disposable {
    // Map from the paths of main LaTeX files paths to their interactive LaTeX document instance
    // This data structure encodes the fact there must be at most one iLaTeX instance per path
	private mainLatexFilePathsToInteractiveLatexDocuments: Map<string, InteractiveLatex>;

    readonly nbInteractiveLatexDocumentsChangeEventEmitter: vscode.EventEmitter<void>;

	constructor() {
		this.mainLatexFilePathsToInteractiveLatexDocuments = new Map();

        this.nbInteractiveLatexDocumentsChangeEventEmitter = new vscode.EventEmitter();
	}

    get nbILatexDocuments(): number {
        return this.mainLatexFilePathsToInteractiveLatexDocuments.size;
    }

    get mainLatexFilePaths(): string[] {
        return [...this.mainLatexFilePathsToInteractiveLatexDocuments.keys()];
    }

    get ilatexDocuments(): InteractiveLatex[] {
        return [...this.mainLatexFilePathsToInteractiveLatexDocuments.values()];
    }

    hasDocument(ilatexDocument: InteractiveLatex): boolean {
        return this.ilatexDocuments.includes(ilatexDocument);
    }

    hasDocumentWithMainFilePath(path: string): boolean {
        return this.mainLatexFilePathsToInteractiveLatexDocuments.has(path);
    }

    getDocumentWithMainFilePath(path: string): InteractiveLatex | undefined {
        return this.mainLatexFilePathsToInteractiveLatexDocuments.get(path);
    }

    private createNewILatexDocumentFromMainFileAt(
        uri: vscode.Uri,
        options: InteractiveLatexOptions
    ): Promise<InteractiveLatex> {
        // Create and show a new webview panel
        const fileName = path.basename(uri.path);
        const webviewPanel = createWebview(`i-LaTeX — ${fileName}`);

        // Create and return a new instance of iLaTeX
        // The editor is mapped to the instance of iLateX until it is destroyed
        return InteractiveLatex.fromMainLatexFileAt(uri, webviewPanel, options)
            .then(ilatexDocument => {
                webviewPanel.onDidDispose(() => {
                    this.destroyILatexDocument(ilatexDocument);
                });

                return ilatexDocument;
        });
    }

    createOrShowILatexDocumentFromMainFileAt(
        uri: vscode.Uri,
        options: InteractiveLatexOptions
    ): void {
        const path = uri.path;

        // If there already is an interactive LaTeX document
        // for the given main file, simply reveal its webview
        if (this.mainLatexFilePathsToInteractiveLatexDocuments.has(path)) {
            const ilatexDocument = this.mainLatexFilePathsToInteractiveLatexDocuments.get(path);
            ilatexDocument?.webviewManager.revealWebviewPanel();
            return;
        }

        // Otherwise, attempt to create a new iLatex instance
        try {
            this.createNewILatexDocumentFromMainFileAt(uri, options)
                .then(newIlatexDocument => {
                    // Once the interactive LaTeX document is created and initialised, do some bookkeeping
                    this.mainLatexFilePathsToInteractiveLatexDocuments.set(path, newIlatexDocument);
                    vscode.commands.executeCommand("setContext", "ilatex:hasActiveInstances", true);

                    this.nbInteractiveLatexDocumentsChangeEventEmitter.fire();
                });
        }
        catch (error) {
            vscode.window.showInformationMessage(`An unexpected error occured while creating a new iLaTeX document.`);
            console.error("An unexpected error occured while creating a new iLaTeX instance: ", error);
        }
    }

    createOrShowILatexDocumentFromActiveEditor(options: InteractiveLatexOptions): void {
        // If there is no active editor,
        // display an error message and abort
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage("There is no active editor to init. an iLaTeX document from");
            return;
        }

        // If the active editor has no (document,
        // display an message which explain the problem and abort
        const activeEditorDocument = activeEditor.document;
        if (!activeEditorDocument) {
            vscode.window.showErrorMessage("There is no document in the active editor to init. an iLaTeX document from.");
            return;
        }

        this.createOrShowILatexDocumentFromMainFileAt(activeEditorDocument.uri, options);
    }

    recompileAllILatexDocumentsUsingActiveEditor(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return;
        }
        
        for (let ilatexDocument of this.mainLatexFilePathsToInteractiveLatexDocuments.values()) {
            const activeEditorContainsFileFromCurrentInstance = ilatexDocument.sourceFileManager.sourceFiles.some(file => {
                return file.isRepresentedByDocument(activeEditor.document);
            });
    
            if (activeEditorContainsFileFromCurrentInstance) {
                ilatexDocument.recompileAndUpdate();
            }
        }
    }

    destroyILatexDocument(ilatexDocument: InteractiveLatex): void {
        const mainLatexFilePath = ilatexDocument.mainSourceFileUri.path;
        const mainLatexFileName = path.basename(mainLatexFilePath);

        try {
            ilatexDocument.dispose();
        }
        catch (error) {
            console.error(`An error occured while trying to dispose of an interactive LaTeX document (${mainLatexFileName}):`, error);
        }

        // Do some bookkeeping
        this.mainLatexFilePathsToInteractiveLatexDocuments.delete(mainLatexFilePath);
        vscode.commands.executeCommand(
            "setContext",
            "ilatex:hasActiveInstances",
            this.mainLatexFilePathsToInteractiveLatexDocuments.size > 0
        );

        this.nbInteractiveLatexDocumentsChangeEventEmitter.fire();

        console.info(`An interactive LaTeX document (${mainLatexFileName}) has been destroyed.`);
    }

	destroyILatexDocumentWithMainFilePath(path: string): void {
        const ilatexDocument = this.mainLatexFilePathsToInteractiveLatexDocuments.get(path);
        if (ilatexDocument) {
            this.destroyILatexDocument(ilatexDocument);
        }
    }

    destroyAllILatexDocuments(): void {
        const nbInteractiveLatexDocuments = this.mainLatexFilePathsToInteractiveLatexDocuments.size;
        if (nbInteractiveLatexDocuments === 0) {
            return;
        }

        // Dispose of any remaining iLaTeX instance
        console.warn(`The ${nbInteractiveLatexDocuments} remaining interactive LaTeX documenta are about to be destroyed...`);

        for (let ilatexDocument of this.mainLatexFilePathsToInteractiveLatexDocuments.values()) {
            this.destroyILatexDocument(ilatexDocument);
        }
    }

    dispose(): void {
        this.destroyAllILatexDocuments();
    }
}