import * as vscode from "vscode";

export const decorationTypes = {
    // Styles of decorations of pieces of code that can be visualised
    visualisableCode: vscode.window.createTextEditorDecorationType({
        dark: {
            backgroundColor: "#1A3345",
            borderRadius: "2px"
        },

        light: {
            backgroundColor: "#E1EDF5",
            borderRadius: "2px"            
        }
    }),
};