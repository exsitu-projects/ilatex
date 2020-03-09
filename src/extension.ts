import * as vscode from 'vscode';
import { InteractiveLaTeX } from './InteractiveLaTeX';


export function activate(context: vscode.ExtensionContext) {
	console.log('InteractiveLaTeX has been initialised.');

	let disposable = vscode.commands.registerCommand('ilatex.init', () => {
		vscode.window.showInformationMessage('init has been called!');

		const activeDocumentPath = vscode.window.activeTextEditor?.document.uri.fsPath;
		if (activeDocumentPath) {
			const iLaTeX = new InteractiveLaTeX(activeDocumentPath);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	// TODO
}
