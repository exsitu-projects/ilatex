// Declare the type of the global 'acquireVsCodeApi' function provided by VSCode
// Should the webview code require other fields of the returned object, it should be updated here
declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
};

// Request an access to the VSCode API
export const vscode = acquireVsCodeApi();
