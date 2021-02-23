import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { InteractiveLatex } from "../InteractiveLaTeX";

export class PDFManager {
    private ilatex: InteractiveLatex;

    private buildTaskIsRunning: boolean;
    private lastBuildFailed: boolean;
    private hasAlreadrBuiltPdfOnce: boolean;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;

        this.buildTaskIsRunning = false;
        this.lastBuildFailed = false;
        this.hasAlreadrBuiltPdfOnce = false;
    }

    get pdfUri(): vscode.Uri {
        return vscode.Uri.file(this.ilatex.mainSourceFileUri.path.replace(".tex", ".pdf"));
    }

    get compilationLogUri(): vscode.Uri {
        return vscode.Uri.file(this.ilatex.mainSourceFileUri.path.replace(".tex", ".log"));
    }

    get pdfExists(): boolean {
        return fs.existsSync(this.pdfUri.path);
    }

    get isBuildingPDF(): boolean {
        return this.buildTaskIsRunning;
    }

    dispose(): void {

    }

    // Return a promise which is resolved when the compilation of the LaTeX document succeeds
    // and rejected when the compilation fails, or a failing promise if a build task is already running
    recompilePDF(notifyWebview: boolean = true): Promise<void> {
        if (this.isBuildingPDF) {
            return Promise.reject("The PDF building task did not start: at most one building task can be ran at once.");
        }

        return new Promise<void>((resolveCompilation, rejectCompilation) => {
            if (notifyWebview) {
                this.ilatex.webviewManager.sendNewPDFCompilationStatus(true);
            }

            // Create a new terminal and use it to run latexmk to build a PDF from the sources
            const terminal = vscode.window.createTerminal("iLaTeX");
            const observer = vscode.window.onDidCloseTerminal(closedTerminal => {
                // Ensure the closed terminal is the one created just above
                if (closedTerminal !== terminal) {
                    return;
                }

                // The callback will be used only once; therefore it can be removed safely
                observer.dispose();

                // Depending on the exit code, either resolve or reject the promise
                // returned by the buildPDF method
                if (closedTerminal.exitStatus && closedTerminal.exitStatus.code !== 0) {
                    this.lastBuildFailed = true;
                    rejectCompilation("LaTeX compilation error");

                    if (notifyWebview) {
                        this.ilatex.webviewManager.sendNewPDFCompilationStatus(false, true);
                    }
                }
                else {
                    this.lastBuildFailed = false;
                    resolveCompilation();

                    if (notifyWebview) {
                        this.ilatex.webviewManager.sendNewPDFCompilationStatus(false, false);
                    }
                }

                this.buildTaskIsRunning = false;
                this.hasAlreadrBuiltPdfOnce = true;
            });

            // Prepare some command arguments
            const terminalSafeMainFilePath = this.ilatex.mainSourceFileUri.path.replace(/ /g, "\\ ");
            const extraOptions: string[] = [];

            // If the last build failed, or if this is the first build of this instance, force a full re-compilation
            if (this.lastBuildFailed || !this.hasAlreadrBuiltPdfOnce) {
                extraOptions.push(`-g`);
            }
            
            // Run latexnk to compile the document and close the terminal afterwards
            // (if no exit code is specified, the exit command reuses the exit code
            // of the last command ran in the terminal, i.e. in this case, latexmk)
            terminal.sendText(`cd ${path.dirname(terminalSafeMainFilePath)}`);
            terminal.sendText(`latexmk -silent -interaction=nonstopmode ${extraOptions.join(" ")} ${terminalSafeMainFilePath}`);
            terminal.sendText(`exit`);
        })
        .catch(() => {
            vscode.window.showErrorMessage(
                "An error occured during the compilation of the document.",
                { title: "Open log" }
            ).then(clickedItem => {
                // If the "Open log" button was clicked, open the compilation log file
                // Otherwise, if the message was dismissed, do not do anything
                if (clickedItem) {
                    vscode.window.showTextDocument(this.compilationLogUri, {
                        viewColumn: vscode.ViewColumn.Two
                    });
                }
            });
        });
    }

    updateWebviewPDF(): void {
        this.ilatex.webviewManager.sendNewPDF();
    }

    recompilePDFAndUpdateWebview(): Promise<void> {
        // Use the terminal closing as a signal to trigger an update of the webview PDF
        // This is a workaround to the fact that there is no built-in way
        // to wait for the end of a running process in a VSCode terminal
        return this.recompilePDF()
            .then(() => { this.updateWebviewPDF(); });
    }
}