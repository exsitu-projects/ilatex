import * as vscode from "vscode";
import * as path from "path";
import { InteractiveLatex } from "./InteractiveLaTeX";

// Map from root LaTeX document paths to their iLaTeX instances
// Note: there must be at most one iLaTeX instqnce per root
const rootLatexDocumentPathsToIlatexInstances = new Map<string, InteractiveLatex>();

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

function createIlatexInstanceForRootDocument(document: vscode.TextDocument, enableVisualisations: boolean): Promise<InteractiveLatex> {
	// Create and show a new webview panel
	const fileName = path.basename(document.fileName);
	const webviewPanel = createWebview(`iLatex — ${fileName}`);

	// Create and return a new instance of iLaTeX
	// The editor is mapped to the instance of iLateX until it is destroyed
	return InteractiveLatex.fromMainLatexDocument(document, webviewPanel, { enableVisualisations: enableVisualisations })
		.then(ilatex => {
			webviewPanel.onDidDispose(() => {
				console.info(`The iLaTeX instance for root document "${path.basename(document.uri.path)}" will be removed...`);

				ilatex.dispose();

				rootLatexDocumentPathsToIlatexInstances.delete(document.uri.path);
				vscode.commands.executeCommand("setContext", "ilatex:hasActiveInstances", rootLatexDocumentPathsToIlatexInstances.size > 0);

				console.info(`The iLaTeX instance for root document "${path.basename(document.uri.path)}" has been removed (its webview panel was closed).`);
			});

			return ilatex;
		});
}

async function tryCreatingNewILatexInstanceFromActiveEditor(context: vscode.ExtensionContext, enableVisualisations: boolean = true): Promise<void> {
	// iLaTeX cannot be initialised without a host editor (which should contain a LaTeX file)
	// If there is no active editor, display an error message and abort
	const editor = vscode.window.activeTextEditor;

	if (!editor) {
		vscode.window.showErrorMessage("iLaTeX can only be initialised from an active text editor. Please give focus to such an editor and try again.");
		return;
	}

	// iLaTeX requires an open LaTeX document to work with
	// If the editor has no document, display an message which explain the problem and abort
	const document = editor.document;

	if (!document) {
		vscode.window.showErrorMessage("iLaTeX can only be initialised from a root LaTeX document. Please open one and try again.");
		return;
	}

	// There cannot be 2+ instances of iLaTeX for the same root LaTeX document
	// If there already is an instance, make sure the webview is visible and abort
	const documentPath = document.uri.path;

	if (rootLatexDocumentPathsToIlatexInstances.has(documentPath)) {
		const iLatex = rootLatexDocumentPathsToIlatexInstances.get(documentPath);
		iLatex?.webviewManager.revealWebviewPanel();
		return;
	}

	// Try to create a new iLatex instance
	// If it succeeds, display a success message and map the editor to the new instance
	// If it fails, display an error message
	try {
		const ilatex = await createIlatexInstanceForRootDocument(document, enableVisualisations);
		
		// vscode.window.showInformationMessage(`A new instance of iLatex has been started from root document ${path.basename(documentPath)}.`);

		rootLatexDocumentPathsToIlatexInstances.set(documentPath, ilatex);
		vscode.commands.executeCommand("setContext", "ilatex:hasActiveInstances", true);
	}
	catch (error) {
		vscode.window.showInformationMessage(`An unexpected error occured while creating a new iLaTeX instance.`);
		console.error("An unexpected error occured while creating a new iLaTeX instance: ", error);
	}
}

function tryRecompilingILatexDocumentsUsingActiveEditor(): void {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor || !activeEditor.document) {
		return;
	}
	
	for (let ilatexInstance of rootLatexDocumentPathsToIlatexInstances.values()) {
		const activeEditorContainsFileFromCurrentInstance = ilatexInstance.sourceFileManager.sourceFiles.some(file => {
			return file.isRepresentedByDocument(activeEditor.document);
		});

		if (activeEditorContainsFileFromCurrentInstance) {
			ilatexInstance.recompileAndUpdate();
		}
	}
}

function stopAllILatexInstances(): void {
	console.warn(`Stopping the ${rootLatexDocumentPathsToIlatexInstances.size} iLaTeX instances currently running...`);

	// Dispose of any remaining iLaTeX instance
	for (let ilatex of rootLatexDocumentPathsToIlatexInstances.values()) {
		try {
			ilatex.dispose();
		}
		catch (error) {
			console.error(`An error occured while disposing of the iLaTeX instance of file ${path.basename(ilatex.mainSourceFileUri.path)}:`, error);
		}
	}

	rootLatexDocumentPathsToIlatexInstances.clear();

	console.warn(`All the iLaTeX instances have now been disposed.`);
}

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		// Commands to initialise iLaTeX with and without interactive visualisations
		// from the file opened in the current active editor (if any)
		vscode.commands.registerCommand("ilatex.initWithVisualisations", async () => {
			await tryCreatingNewILatexInstanceFromActiveEditor(context, true);
		}),

		vscode.commands.registerCommand("ilatex.initWithoutVisualisations", async () => {
			await tryCreatingNewILatexInstanceFromActiveEditor(context, false);
		}),

		// Command to recompile the LaTeX documents associated with the file opened in the current active editor (if any)
		vscode.commands.registerCommand("ilatex.recompile", async () => {
			tryRecompilingILatexDocumentsUsingActiveEditor();
		}),

		// Command to stop any instance of iLaTeX that is currently running
		vscode.commands.registerCommand("ilatex.stopAllInstances", async () => {
			stopAllILatexInstances();
		})
	);
}

export function deactivate(): void {
	stopAllILatexInstances();
}
