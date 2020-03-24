import * as vscode from 'vscode';
import { InteractiveLaTeX } from './InteractiveLaTeX';


export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('ilatex.init', () => {
		vscode.window.showInformationMessage("iLatex has been initialised!");

		const activeDocument = vscode.window.activeTextEditor?.document;
		if (activeDocument) {
			const iLatex = new InteractiveLaTeX(activeDocument);
			console.log(iLatex);

			// Create and show a new panel
			const fileName = activeDocument.fileName;
			const panel = vscode.window.createWebviewPanel(
				"ilatex",
				`iLatex – ${fileName}`,
				vscode.ViewColumn.Two,
				{}
			);
		
			// Set the panel's content
			panel.webview.html = "Hello, world!";
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	// TODO
}
