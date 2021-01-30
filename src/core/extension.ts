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

function createIlatexInstanceForRootDocument(document: vscode.TextDocument): Promise<InteractiveLatex> {
	// Create and show a new webview panel
	const fileName = path.basename(document.fileName);
	const webviewPanel = createWebview(`iLatex — ${fileName}`);

	// Create and return a new instance of iLaTeX
	// The editor is mapped to the instance of iLateX until it is destroyed
	return InteractiveLatex.createFromMainLatexDocument(document, webviewPanel)
		.then(ilatex => {
			webviewPanel.onDidDispose(() => {
				ilatex.webviewManager.dispose();

				rootLatexDocumentPathsToIlatexInstances.delete(document.uri.path);
				vscode.commands.executeCommand("setContext", "ilatex:hasActiveInstances", rootLatexDocumentPathsToIlatexInstances.size > 0);

				console.info(`The iLaTeX instance for root LaTeX document ${path.basename(document.uri.path)} has been removed (after its webview panel has been closed).`);
			});

			return ilatex;
		});
}

export function activate(context: vscode.ExtensionContext): void {
	let disposable = vscode.commands.registerCommand("ilatex.init", () => {
		
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
		// If/when it succeeds, display a success message and map the editor to the new instance
		createIlatexInstanceForRootDocument(document)
			.then(ilatex => {
				vscode.window.showInformationMessage(`A new instance of iLatex has been started from root document ${path.basename(documentPath)}.`);

				rootLatexDocumentPathsToIlatexInstances.set(documentPath, ilatex);
				vscode.commands.executeCommand("setContext", "ilatex:hasActiveInstances", true);
			});
	});

	let disposable2 = vscode.commands.registerCommand("ilatex.recompile", async () => {
		console.log("ilatex recompile command");
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor || !activeEditor.document) {
			return;
		}
		
		for (let ilatexInstance of rootLatexDocumentPathsToIlatexInstances.values()) {
			const activeEditorContainsFileFromCurrentInstance = ilatexInstance.codeMappingManager.allSourceFiles.some(file => {
				return file.absolutePath === activeEditor.document.uri.path;
			});

			if (activeEditorContainsFileFromCurrentInstance) {
				await ilatexInstance.updatePDFAndVisualisations();
			}
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
}

export function deactivate(): void {
	// Dispose of any remaining iLaTeX instance
	for (let ilatex of rootLatexDocumentPathsToIlatexInstances.values()) {
		ilatex.dispose();
	}

	rootLatexDocumentPathsToIlatexInstances.clear();
}
