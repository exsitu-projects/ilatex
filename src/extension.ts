import * as vscode from 'vscode';
import { InteractiveLaTeX } from './InteractiveLaTeX';


export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('ilatex.init', () => {
		vscode.window.showInformationMessage("iLatex has been initialised!");

		const activeEditor = vscode.window.activeTextEditor;
		const activeDocument = activeEditor?.document;

		if (activeDocument) {
			// Create and show a new panel
			const fileName = activeDocument.fileName;
			const webviewPanel = vscode.window.createWebviewPanel(
				"ilatex",
				`iLatex – ${fileName}`,
				vscode.ViewColumn.Two,
				{
					enableScripts: true
				}
			);
		
			// Set the panel's content
			webviewPanel.webview.html = "Hello, world!";

			// Initialise the top-level class of the extension
			if (activeEditor) {
				const iLatex = new InteractiveLaTeX(activeEditor, webviewPanel);
				console.log(iLatex);
			}
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	// TODO
}
