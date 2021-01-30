import * as vscode from "vscode";

export const textDecorations = {
    // Styles of decorations of pieces of code that used to be visualisable
    // and that have been manually edited by the user
    manuallyEditedVisualisableCode: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 20, 20, 0.2)",
        borderRadius: "2px"
    }),
};