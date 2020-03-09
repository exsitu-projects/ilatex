import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('InteractiveLaTeX has been initialised.');

	let disposable = vscode.commands.registerCommand('ilatex.init', () => {
		vscode.window.showInformationMessage('init has been called!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
	// TODO
}
