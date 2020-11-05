import * as vscode from "vscode";
import * as fs from "fs";
import { InteractiveLatex } from "../InteractiveLaTeX";



export class PDFManager {
    private ilatex: InteractiveLatex;

    constructor(ilatex: InteractiveLatex) {
        this.ilatex = ilatex;
    }

    get pdfUri(): vscode.Uri {
        return vscode.Uri.file(this.ilatex.mainSourceFileUri.path.replace(".tex", ".pdf"));
    }

    get pdfExists(): boolean {
        return fs.existsSync(this.pdfUri.path);
    }

    dispose(): void {

    }

    // Return a promise which is resolved when the compilation of the LaTeX document succeeds
    // and rejected when the compilation fails
    buildPDF(): Promise<void> {
        return new Promise<void>((resolveCompilation, rejectCompilation) => {
            // Create a new terminal and use it to run latexmk to build a PDF from the sources
            const terminal = vscode.window.createTerminal("iLaTeX");
            const observer = vscode.window.onDidCloseTerminal(terminal => {
                // The callback will be used only once; therefore it can be removed safely
                observer.dispose();

                if (terminal.exitStatus && terminal.exitStatus.code !== 0) {
                    rejectCompilation("LaTeX compilation error");
                    return;
                }

                resolveCompilation();
            });

            const terminalSafeFilename = this.ilatex.mainSourceFileUri.path.replace(/ /g, "\\ ");
            terminal.sendText(`cd ${terminalSafeFilename.substr(0, terminalSafeFilename.lastIndexOf("/"))}`);
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