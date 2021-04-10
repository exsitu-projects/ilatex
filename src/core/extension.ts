import * as vscode from "vscode";
import { InteractiveLatexExtensionContext } from "./InteractiveLatexExtensionContext";

export function activate(context: vscode.ExtensionContext): void {
	// All the setup is delegated to the iLaTeX extension context
	// It is a singleton that must be created one time only, when the extension is activated.
	InteractiveLatexExtensionContext.createOrGetUniqueInstance(context);
}

export function deactivate(): void {
	// The cleanup is automatically delegated to the iLaTeX extension context,
	// including disposing of itself
}
