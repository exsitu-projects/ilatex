import * as vscode from "vscode";

export const decorationTypes = {
    // Styles of decorations of pieces of code that can be visualised
    visualisableCode: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(20, 20, 255, 0.2)",
        borderRadius: "2px"
    }),

    // Styles of decorations of pieces of code that used to be visualisable
    // and that have been manually edited by the user
    manuallyEditedVisualisableCode: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 20, 20, 0.2)",
        borderRadius: "2px"
    }),
};