import * as vscode from 'vscode';
import * as path from "path";
import { InteractiveLaTeX } from './InteractiveLaTeX';

// TODO: there seems to be no way to watch when an editor is closed at the moment,
// but any iLaTeX instance attached to an editor which has just been closed
// should be destroyed

// Map from VSCode text editors to iLaTeX instances
// Note that there should be at most one instance per editor
const editorsToILatexInstances = new Map<vscode.TextEditor, InteractiveLaTeX>();

function createWebview(title: string): vscode.WebviewPanel {
	return vscode.window.createWebviewPanel(
		"ilatex",
		title,
		vscode.ViewColumn.Two,
		{
			enableScripts: true
		}
	);
}

function createILatexInstanceFor(editor: vscode.TextEditor): InteractiveLaTeX | null {
	const document = editor.document;

	// iLaTeX requires an open LaTeX document to work with
	// If the editor has no document, display an message which explain the problem and fail
	if (!document) {
		vscode.window.showErrorMessage("iLaTeX cannot be used with an empty editor; open a LaTeX document and try again.");
		return null;
	}

	// Create and show a new webview panel
	const fileName = path.basename(document.fileName);
	const webviewPanel = createWebview(`iLatex — ${fileName}`);

	// Create and return a new instance of iLaTeX
	// The editor is mapped to the instance of iLateX until it is destroyed
	const iLatex = new InteractiveLaTeX(editor, webviewPanel);
	webviewPanel.onDidDispose(() => {
		iLatex.onWebviewPanelClosed();
		editorsToILatexInstances.delete(editor);
	});

	return iLatex;
}

export function activate(context: vscode.ExtensionContext): void {
	let disposable = vscode.commands.registerCommand('ilatex.init', () => {
		const editor = vscode.window.activeTextEditor;

		// iLaTeX cannot be initialised without a host editor (which should contain a LaTeX file)
		// If there is no active editor, display an error message and fail
		if (!editor) {
			vscode.window.showErrorMessage("iLaTeX can only be started from an active text editor.");
			return;
		}

		// There cannot be 2+ instances of iLaTeX for the same editor at the same file
		// If there already is an instance, make sure the webview is visible
		if (editorsToILatexInstances.has(editor)) {
			const iLatex = editorsToILatexInstances.get(editor);
			iLatex?.revealWebviewPanel();

			return;
		}

		// Try to create a new iLatex instance
		// If it succeeds, display a success message and map the editor to the new instance
		const iLatex = createILatexInstanceFor(editor);

		if (iLatex) {
			vscode.window.showInformationMessage("A new instance of iLatex has been started!");
			editorsToILatexInstances.set(editor, iLatex);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate(): void {
	editorsToILatexInstances.clear();
}
