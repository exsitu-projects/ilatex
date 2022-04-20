import * as vscode from "vscode";

export const textDecorations = {
    // For debug purposes only
    transitionalAstNode: vscode.window.createTextEditorDecorationType({
        border: "1px solid rgba(255, 100, 100, 0.25)",
        borderRadius: "2px"
    }),

    // For debug purposes only
    availableTransitionalCode: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(20, 20, 255, 0.00)",
        borderRadius: "2px"
    }),

    unavailableTransitionalCode: vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 20, 20, 0.2)",
        borderRadius: "2px"
    }),
};