import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { InteractiveLatex } from "../InteractiveLaTeX";



export class PDFManager {
    private ilatex: InteractiveLatex;
    private buildTaskIsRunning: boolean;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
        this.buildTaskIsRunning = false;
    }

    get pdfUri(): vscode.Uri {
        return vscode.Uri.file(this.ilatex.mainSourceFileUri.path.replace(".tex", ".pdf"));
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
    buildPDF(notifyWebview: boolean = true): Promise<void> {
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

                if (notifyWebview) {
                    this.ilatex.webviewManager.sendNewPDFCompilationStatus(false);
                }

                // Depending on the exit code, either resolve or reject the promise
                // returned by the buildPDF method
                if (closedTerminal.exitStatus && closedTerminal.exitStatus.code !== 0) {
                    rejectCompilation("LaTeX compilation error");
                }
                else {
                    resolveCompilation();
                }

                this.buildTaskIsRunning = false;
            });

            const terminalSafeFilename = this.ilatex.mainSourceFileUri.path.replace(/ /g, "\\ ");
            terminal.sendText(`cd ${path.dirname(terminalSafeFilename)}`);
            terminal.sendText(`latexmk -interaction=nonstopmode ${terminalSafeFilename}`);
            // terminal.sendText(`latexmk -c`);
            
            // Close the terminal right after running latexmk
            // Note: if no exit code is specified, the exit command
            // reuses the exit code output by the last command
            terminal.sendText(`exit`);
        })
        .catch(() => {
            vscode.window.showErrorMessage("An error occured during the compilation of the document.");
        });
    }

    updateWebviewPDF(): void {
        this.ilatex.webviewManager.sendNewPDF(this.pdfUri);
    }

    buildPDFAndUpdateWebview(): Promise<void> {
        // Use the terminal closing as a signal to trigger an update of the webview PDF
        // This is a workaround to the fact that there is no built-in way
        // to wait for the end of a running process in a VSCode terminal
        return this.buildPDF()
            .then(() => { this.updateWebviewPDF(); });
    }
}