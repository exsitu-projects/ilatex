import * as vscode from "vscode";
import { InteractiveLatexOptions } from "./InteractiveLaTeX";
import { InteractiveLatexDocumentManager } from "./InteractiveLatexDocumentManager";


// Note: this class is meant to be a singleton living as long as the extension lives.
// Once created, the unique instance can be accessed through the dedicated static getter.
export class InteractiveLatexExtensionContext {
	private static _singletonInstance: InteractiveLatexExtensionContext | null = null;

    readonly context: vscode.ExtensionContext;
    private statusBarItem: vscode.StatusBarItem;
	private ilatexDocumentManager: InteractiveLatexDocumentManager;

	private nbILatexDocumentChangeObserverDisposable: vscode.Disposable;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;

		// Automatically dispose of this context when the extension is deactivated
		context.subscriptions.push({
			dispose: this.dispose
		});

		// Initialise the main components of the extension
		this.registerCommands();
		this.statusBarItem = this.createStatusBarItem();
		this.ilatexDocumentManager = new InteractiveLatexDocumentManager();

		this.nbILatexDocumentChangeObserverDisposable =
			this.ilatexDocumentManager.nbInteractiveLatexDocumentsChangeEventEmitter.event(() => {
				this.updateStatusBarItem();
			});

		this.updateStatusBarItem();
		this.statusBarItem.show();
    }

	private showFileSelectorToCreateNewILatexDocument(
		options: InteractiveLatexOptions
	): void {
		vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: "Open with i-LaTeX",
			title: "Select the main LaTeX file to open with i-LaTeX"
		}).then(uri => {
			if (uri && uri.length > 0) {
				this.ilatexDocumentManager.createOrShowILatexDocumentFromMainFileAt(uri[0], options);
			}
		});
	}

	private showILatexDocumentCreationMenu(): void {
		vscode.window.showQuickPick(
			[
				{
					label: "$(default-view-icon) Create from the active editor",
					alwaysShow: true
				},
				{
					label: "$(default-view-icon) Create from the active editor",
					description: "(disable code visualisations)",
					alwaysShow: true
				},
				{
					label: "$(search-view-icon) Create from file...",
					alwaysShow: true
				},
				{
					label: "$(search-view-icon) Create from file...",
					description: "(disable code visualisations)",
					alwaysShow: true
				},
			],
			{
				canPickMany: false,
				matchOnDescription: true,
				matchOnDetail: true,
				placeHolder: "Select the method you want to use to create an i-LaTeX document"
			}
		).then(item => {
			if (!item) {
				return;
			}

			const ilatexOptions = {
				...InteractiveLatexExtensionContext.getPartialILatexOptionsFromExtensionSettings(),
				enableVisualisations:
					!item.description && item.description !== "(disable code visualisations)"
			};
				
			if (item.label === "$(default-view-icon) Create from the active editor") {
				this.ilatexDocumentManager.createOrShowILatexDocumentFromActiveEditor(ilatexOptions);
			}
			else if (item.label === "$(search-view-icon) Create from file...") {
				this.showFileSelectorToCreateNewILatexDocument(ilatexOptions);
			}
		});
	}

	private registerCommands(): void {
		// Automatically unregister the commands when the extension is deactivated
		this.context.subscriptions.push(
			// Command that displays an interactive popup menu te user can use
			// to select the main LaTeX file to create an interactive document from
			vscode.commands.registerCommand("ilatex.showDocumentCreationMenu", async () => {
				this.showILatexDocumentCreationMenu();
			}),

			// Commands to initialise iLaTeX with and without interactive visualisations
			// from the file opened in the current active editor (if any)
			vscode.commands.registerCommand("ilatex.createDocumentFromActiveEditor", async () => {
				this.ilatexDocumentManager.createOrShowILatexDocumentFromActiveEditor({
					...InteractiveLatexExtensionContext.getPartialILatexOptionsFromExtensionSettings(),
					enableVisualisations: true
				});
			}),
	
			vscode.commands.registerCommand("ilatex.createDocumentFromActiveEditorWithoutVisualisations", async () => {
				this.ilatexDocumentManager.createOrShowILatexDocumentFromActiveEditor({
					...InteractiveLatexExtensionContext.getPartialILatexOptionsFromExtensionSettings(),
					enableVisualisations: false,
					
				});
			}),
	
			// Command to recompile the LaTeX documents related to the file opened in the current active editor (if any)
			vscode.commands.registerCommand("ilatex.recompileDocumentsUsingActiveEditor", async () => {
				this.ilatexDocumentManager.recompileAllILatexDocumentsUsingActiveEditor();
			}),
	
			// Command to destroy all the living interactive documents
			vscode.commands.registerCommand("ilatex.destroyAllDocuments", async () => {
				this.ilatexDocumentManager.destroyAllILatexDocuments();
			})
		);
	}

	// Create a status bar item whose purpose is to
	// - show how many interactive documents are currently active;
	// - display a command box to create a new interactive LaTeX document when clicked.
	private createStatusBarItem(): vscode.StatusBarItem {
		const statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			-99999
		);
	
		// statusBarItem.color = "#FF851B";
		(statusBarItem as any).backgroundColor = "#FF851B";
		statusBarItem.command = "ilatex.showDocumentCreationMenu";
	
		// Automatically remove the item when the extension is deactivated
		this.context.subscriptions.push(statusBarItem);

		return statusBarItem;
	}

	private updateStatusBarItem(): void {
		const nbILatexDocuments = this.ilatexDocumentManager.nbILatexDocuments;
		this.statusBarItem.text = nbILatexDocuments === 0
			? `$(circle-large-outline) i-LaTeX`
			: `$(circle-large-filled) i-LaTeX (${nbILatexDocuments})`;
	}

	private dispose(): void {
		this.nbILatexDocumentChangeObserverDisposable.dispose();
	}

	static getPartialILatexOptionsFromExtensionSettings() {
		const settings = vscode.workspace.getConfiguration("ilatex");

		// Local log files
		const enableLocalLoggingSettingValue = settings.get("enableLocalLogging")! as string;
		const enableLocalLogging = enableLocalLoggingSettingValue.toLowerCase().startsWith("enable");
		const localLogFileType = enableLocalLoggingSettingValue.toLowerCase().includes("hidden")
			? "hidden" as const
			: "regular" as const;
		
		// Centralised log files
		const enableCentralisedLogging = settings.get("enableCentralisedLogging")! as boolean;
		const centralisedLoggingDirectoryPath = settings.get("centralisedLoggingDirectoryPath")! as string;

		// Extra options for latexmk
		const extraLatexmkOptions = settings.get("extraLatexmkOptions")! as string;

		return {
			enableLocalLogging: enableLocalLogging,
			localLogFileType: localLogFileType,

			enableCentralisedLogging: enableCentralisedLogging,
			centralisedLoggingDirectoryPath: centralisedLoggingDirectoryPath,

			extraLatexmkOptions: extraLatexmkOptions
		};
	}

	static get uniqueInstance(): InteractiveLatexExtensionContext | null {
		return this._singletonInstance;
	}

	static createOrGetUniqueInstance(context: vscode.ExtensionContext): InteractiveLatexExtensionContext {
		if (!InteractiveLatexExtensionContext.uniqueInstance) {
			InteractiveLatexExtensionContext._singletonInstance = new InteractiveLatexExtensionContext(context);
		}

		return this.uniqueInstance!;
	}
}