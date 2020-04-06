# Interactive LaTeX

This repository contains a Visual Studio Code (VSC) extension developed to test prototypes of interactive intermediate visualisations for snippets of LaTeX code. It currently includes the following visualisations:

* a directly-manipulable image frame for the `includegraphics` command;
* a table with editable cells for the `tabular` environement.

In addition, clicking a visualisation selects the related code snippet in the document, and moving the cursor inside a code snippet attached to a visualisation will highlight the latter.


## Implementation

### Languages and dependencies
The extension is mainly written in TypeScript, with additional HTML, CSS and JavaScript for code dedicated to the webview where the visualisations are rendered.

The extensions relies on [`Parsimmon`](https://github.com/jneen/parsimmon) to parse a simplified subset of LaTeX.


### Code structure
The source code is located in the `src` and `webview` directories.

### `src` directory
The `src` directory contains the code of the core of the extension, which directly interacts with VSC and the LaTeX document.
It is organised around the following sub-directories:

* `ast` contains code used to create and interact with the abstract syntax tree (AST) of the source document (using a grammar of the simplified LaTeX subset);
* `patterns` contains code used to isolate interesting patterns of code in the AST (_e.g._ to create a visualisation out of them);
* `utils` contains various utilities which do not specifically fit anywhere else;
* `visualisations` contains the code used to create interactive visualisations from matching code patterns;
* `webview` contains the code used to populate and communicate with the webview which contains the the visualisations.


### `webview` directory
The `webview` directory contains the _static_ code of the webview, _i.e._ the code used inside the webview's `<iframe>` element which does not need to be generated at runtime — such as the code which handles the interactivity of the visualisations (in contrary to the content of the visualisations for instance). When the extension is initialised, an instance of the `WebviewManager` class is responsible for creating a unique template from some of the files located in this directory.
It is organised around the following sub-directories:

* `scripts` contains JavaScript code used to communicate with the core of the extension and to make the runtime-generated content of the visualisations interactive. Each visualisation should put its own code in a dedicated file;
* `styles` contains CSS code used to style the visualisations. Each visualisation should have its own styles in a dedicated file;
* `templates` contains HTML code used as templates of the HTML page of the webview.


## Build instructions
The extension can be easily built and tested using VSC.
You can follow these steps to try it out:

1. clone this repository (`git clone git@bitbucket.org:daru13/interactive-latex.git`);
2. open it in VSC (`code <repo. directory>`);
3. start the debugger to compile and test the extension (`F5`);
4. in the new window, run the _Initialise iLaTeX_ command (`Cmd + Shift + P`).

Running the command should open a new tab (supposedly in the 2nd column of a 2-columns layout) which contains a webview displaying the visualisations. The webview is fully refreshed every time the document is modified and saved (as long as the parser succeeds in parsing the new version of the document).

_Note that loading (local) resources such as images appears to fail quite often, possibly because of a bug in VSCode/Electron (e.g. see https://github.com/microsoft/vscode/issues/89038)._