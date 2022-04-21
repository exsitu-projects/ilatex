# General information

## Structure of the repository

This repository is organised according to the following architecture:

| Directory     | Description                                                     |
|---------------|-----------------------------------------------------------------|
| `demo`        | LaTeX documents that can be used to try or demo _i_-LaTeX.      |
| `latex`       | LaTeX-related files used by _i_-LaTeX (including `ilatex.sty`). |
| `misc`        | Miscellaneous (e.g., user guide, code snippets, screenshots).   |
| `src`         | Source code of the Visual Studio Code extension.                |
| `node_module` | Dependencies installed by the package manager such as `yarn`.   |
| `out`         | JavaScript output of the code (compiled from TypeScript).       |

The root directory also contains several configuration files:

| File                                | Description                                                                                                                      |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `rollup-plugin-template-inliner.js` | A custom Rollup plugin for inlining JavaScript and CSS files in an HTML file (for the webview).                                  |
| `rollup.config.js`                  | The configuration of Rollup, a JavaScript bundler used to package all the webview's code into a single HTML file.                |
| `package.json`                      | The extension's manifest, which includes metadata (name, version, authors, etc), contribution points, scripts, and dependencies. |
| `tsconfig.json`                     | The root configuration of the TypeScript compiler.                                                                               |
| `tsconfig.core.json`                | The configuration of the TypeScript compiler for the _core_ part of the extension (compiled for a Node.js environment).          |
| `tsconfig.webview.json`             | The configuration of the TypeScript compiler for the _webview_ part of the extension (compiled for a web environment).           |
| `.vscodeignore`                     | The list of files and directories that must **not** be included in the Visual Studio Code extension (.vsce file).                |

Other files and directories include configuration files for Git, GitHub Workflows and ESLint.

The code of the extension is organised into two different parts called the **core** and the **webview**.
This separation is due to a technical constraint imposed by Visual Studio Code: the extension itself is executed in a Node.js environment, but the code of the webview (i.e., the part where the PDF is rendered) is executed in a web environment, in a separate process; and the two of them can only communicate through message passing.

This division implies that the code of the core and the code of the webview must be compiled and bundled in different ways.
Some parts of the code are compiled for a Node.js environment (as specified in `tsconfig.core.json`), while some other parts are compiled for a web environment (as specified in `tsconfig.webview.json`).
For this reason, the `src` directory is subdivided into the four following subdirectories:

- The `core` subdirectory contains files used by the core;
- The `webview` subdirectory contains files used by the webview;
- The `shared` subdirectory contains files that can be used in both the core and the webview;
- The `transitionals` subdirectory contains one directory per transitional. Each of them must contain two directories: one for the model (`model`), which is only included in the core, and one for the view (`view`), which is only included in the webview. The `transitionals` subdirectory also contains two files describing the list of all the model providers (`model-providers.ts`) and the list of all the view providers (`view-providers.ts`) that can be used by _i_-LaTeX.

In addition, the `webview/template` and `transitionals/*/view` directories can contain a `static` directory, which is meant to contain JavaScript (in a `js` directory) and CSS (in a `css` directory) files that must be included in the code of the webview, which is turned into a single HTML file during the build process.



## Build process

To build the extension for Visual Studio Code, the code of _i_-LaTeX must be compiled and bundled into a single .vsce file.
In order to do this, the following steps must be performed:

1. The code of the webview must be compiled (from TypeScript to JavaScript);
2. The resulting JavaScript, along with static JavaScript libraries and CSS files, must be inlined into a single HTML file;
3. The code of the core must be compiled (from TypeScript to JavaScript);
4. All the files used by the extension must be bundled into an `ilatex.vsce` file using the [`vsce`](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#vsce) utility program.

The scripts defined in `package.json` can be used to perform these steps.
Steps 1 to 3 can be performed by running the `build` command, and step 4 can be performed by running the `package` command (e.g., `yarn run build && yarn run package`).



## Dependencies

### External dependencies

Since _i_-LaTeX is implemented as an extension for the Visual Studio Code, it must be installed on a sufficiently recent version of the editor.
In addition, a recent distribution of LaTeX must be installed.
It must include the packages required by [`ilatex.sty`](latex/ilatex.sty), as well as the `latexmk` utility, which must be available via a terminal, as it is used internally by _i_-LaTeX to compile LaTeX documents.


### Internal dependencies

Internally, _i_-LaTeX uses a number of dependencies listed in `package.json` and managed by a package manager such as `yarn` or `npm`.
After cloning the repository, you can install them by running `yarn` or `npm install`.

In addition, the webview uses several libraries that are not specified in `package.json`.
This choice was motivated by two reasons:

- Rollup has not been configured to search packages in `node_modules` when packaging the webview's code;
- Some libraries (KaTeX, Handsontable) have been manually fixed/customised.





# How does _i_-LaTeX work?

A _Transitional representation_ (_transitional_ for short) is a concept introduced and defined in the CHI'22 paper that presents _i_-LaTeX.
Overall, it consists of an alternative representation of a fragment of code that facilitates understanding and/or manipulating the concept it encodes, that is linked to the output it generates (in the context of a document description language such as LaTeX).

This guide explains how _i_-LaTeX works to offer transitionals for LaTeX, step by step, and answers questions such as:
- What is `ilatex.sty` and what is the purpose of the special commands and environements that must be used?
- What is the entry point of the Visual Studio Code extension, and how is it initialised?
- What are the files read by the extension, and how are they represented amd manipulated in the code?
- What are the purpose of the models and the views of the transitionals, and how do they communicate?
- How does _i_-LaTeX display a PDF augmented with transitionals?
- How do miscellaneous features such as log files and LaTeX lengths work in _i_-LaTeX?



## Special LaTeX commands and environments

As explained in [_i_-LaTeX's user guide](misc/user-guide.pdf), transitionals are only available for _special_ commands and environments, which must be used in place of their counterparts.
For instance, in order to use the interactive grid provided by the transitional for tables, one must use the `itabular` environment instead of the regular `tabular` environment.

This requirement is due to the fact that using these special commands has two additional side effects that are required for _i_-LaTeX's to work:

- they surround the content they generate with a PDF annotation tagged with a unique ID;
- they append an entry to an external file of _code mappings_ (`<main filename>.ilatex-mappings`), which contains the same ID along with other metadata (filename, position in the file, type of content, normalised value of several length macros and units, etc).

Note that regular commands and environments can also be patched to produce the same side effects!
It was not done in this prototype because patching commands such as `\includegraphics` was more tricky than expected, and the way these side effects are currently implemented may break other commands and environments, but it is technically feasible.

In the current implementation, these special commands and environments are defined in the [`ilatex.sty`](latex/ilatex.sty) LaTeX package, which must be imported in a LaTeX document to make it benefit from transitionals.
The package also performs a few other housekeeping tasks, such as creating a counter for the unique IDs, creating the file of code mappings, and patching the `\graphicspath` commands to collect the list of paths that can be used with `\includegraphics`. 



## Starting the extension

The entry point of the extension is [`extension.ts`](src/core/extension.ts), as specified in the [`package.json`](package.json) manifest, along with a number of contributions points.
The contribution points describe the commands (e.g., to open and close a LaTeX document with _i_-LaTeX), code snippets (defined in [`snippets/ilatex.json`](snippets/ilatex.json)) and settings (e.g., enable/disable logging, specify extra arguments for `latexmk`) that are provided by _i_-LaTeX.

The only role of `extension.ts` is to export `activate` and `deactivate` functions, which are executed by Visual Studio Code when loading/unloading the extension.
The actual initialisation is delegated to an extension context singleton ([`InteractiveLatexExtensionContext`](src/core/InteractiveLatexExtensionContext.ts)), which sets up the integration of _i_-LaTeX in Visual Studio Code (e.g., defining the commands described by the contribution points, adding UI elements).
The management of the LaTeX document themselves is further delegated to an instance of [`InteractiveLatexDocumentManager`](src/core/InteractiveLatexDocumentManager.ts), which is responsible for creating and deleting one instance of [`InteractiveLatex`](src/core/InteractiveLatex.ts) for each unique path to the main LaTeX file of a LaTeX document.

`InteractiveLatex` represents a single latex document opened with _i_-LaTeX.
It owns a number of managers with different concerns, which all keep a reference to their parent `InteractiveLatex` instance, so that they can directly access the other managers' APIs.



## Initialising the webview

The webview of each LaTeX document is created by `InteractiveLatexDocumentManager` during their instantiation (using the `createWebview` function).
However, the webview does not contain anything by default, and the only way to set its content provided by the Visual Studio Code API is to replace the content of the entire HTML page displayed by the webview.
This is why (1) the code is separated between the _core_ and the _webview_ and (2) all the files used by the webview must be inlined into a single HTML file (`out/webview/webview.inlined.html`) so that the core can read it once and use it to initialise the webview.
In _i_-LaTeX, this is the responsibility of the webview manager ([`WebviewManager`](src/core/webview/WebviewManager.ts)) of each LaTeX document (using the `setInitialWebviewHtml` method).
Once both the core and the webview are initialised, they can communicate to exchange information and update each other without having to change the code of the entire webpage each time (see the _Exchanging messages with the webview_ section for more details).



## Compiling LaTeX documents

When a LaTeX document is opened or saved with _i_-LaTeX, it is (re)compiled by _i_-LaTeX to produce (1) a new PDF document and (2) a new file of code mappings.
The compilation is handled by the LaTeX compiler manager ([`LatexCompilerManager`](src/core/latex-compiler/LatexCompilerManager.ts)) of the corresponding `InteractiveLatex` instance.
It creates a virtual terminal, uses it to run the `latexmk` utility on the main LaTeX file with a number of arguments, and waits for its completion.

If the compilation succeeds, a message indicating that a new PDF is available is sent to the webview by to the webview manager ([`WebviewManager`](src/core/webview/WebviewManager.ts)), which is responsible for loading and displaying it.
If the compilation fails, an error message is displayed by the LaTeX compiler manager.



## Reading source files and code mappings

Once the document has been recompiled, the code mapping manager ([`CodeMappingManager`](src/core/code-mappings/CodeMappingManager.ts)) is responsible for reading the file of code mappings (generated by the LaTeX compiler) and creating objects representing all the code mappings ([`CodeMapping`](src/core/code-mappings/CodeMapping.ts)).
From there, the source file manager ([`SourceFileManager`](src/core/source-files/SourceFileManager.ts)) creates an object representing a source file ([`SourceFile`](src/core/source-files/SourceFile.ts)) for each unique path in all the code mapping objects.

Internally, sources files are represented by two different structures: a text document representing the content of the file ([`TextDocument`](https://code.visualstudio.com/api/references/vscode-api#TextDocument) objects provided by Visual Studio Code) and an abstract syntax tree (AST) representing the structure of the code ([`LatexAST`](src/core/ast/LatexAST.ts)).
They are related to a number of concepts, which are used in various locations in the code, as they are helpful for manipulating source files.

- Location information in the form of _positions_ ([`SourceFilePosition`](src/core/source-files/SourceFilePosition.ts)) and _ranges_ ([`SourceFileRange`](src/core/source-files/SourceFileRange.ts)) represent. They offer a number of methods for operating on them (such as comparing two of them or converting them from/to Visual Studio Code's Position and Range objects). In addition, position can be _shifted_ to record the difference between the initial and the new values of the line, column and offset of a position. This is used to keep using the same `SourceFilePosition` obects when the file is modified but the AST is not recreated from scratch, in order to avoid having to update all the references to a position (that may be copied in other locations than the AST, e.g., in the model of a transitional);
- Two kinds of _editors_ for performing an atomic edit in a source file: a regular editor ([`SourceFileEditor`](src/core/source-files/SourceFileEditor.ts), and a _transient_ editor ([`TransientSourceFileEditor`](src/core/source-files/TransientSourceFileEditor.ts)), which is designed to support rapid sequences of changes (e.g., changing numeric values while an image is resized interactively in a transitional) where only the last change should be recorded as a change in the file, which is a costful operation (as it requires to update the AST and possibly update transitionals);
- Change events ([`SourceFileChange`](src/core/source-files/SourceFileChange.ts)), which are used to update the AST and the transitionals when a file is modified (either by a manual edit or by interacting with a transitional). Changes are detected and processed by the source file manager (see `processTextDocumentChange`), logged if required (see _Logging_ section for details), and forwarded to the AST (which may reparse the node).


## Working with abstract syntax trees

While the interface with the file system is delegated to Visual Studio Code, which is responsible for reading and writing the content of each source file, the construction and the management of the syntactic structure of each source file is performed by _i_-LaTeX.

Unlike most programming languages, LaTeX has no predefined grammar; and there is no way to build a parser accepting all the LaTeX documents that compile using traditional parser generators, as explained in [this StackExchange thread](https://tex.stackexchange.com/questions/4201/is-there-a-bnf-grammar-of-the-tex-language).
However, by making a number of assumptions, such as `\` representing the start of a macro and the structure of environments, it is possible to create a parser that accepts a large subset of all valid LaTeX documents, though it may fail in certain situations.
To maximise parsing success, and unlike more specialised parsers (such as those of [KaTeX](https://katex.org/) and [MathJax](https://www.mathjax.org/) for mathematics), _i_-LaTeX uses a fairly high-level grammar, with mostly generic nodes.
In our experience, this makes the parser more robust for parsing files that mainly contain content (which is what current transitionals are designed for), in contrast with files with a lot of macro definitions, low-level TeX syntax, etc.

Each file is represented by an abstract syntax tree ([`LatexAST`](src/core/ast/LatexAST.ts)), which is created by the LaTeX parser ([LatexParser](src/core/ast/LatexParser.ts)) and contains a hierarchical structure of nodes that all extend the same class ([`ASTNode`](src/core/ast/nodes/ASTNode.ts)).
Most commands and environments are represented by generic nodes ([`CommandNode`](src/core/ast/nodes/CommandNode.ts), [`EnvironmentNode`](src/core/ast/nodes/EnvironmentNode.ts)) with no parameter.
If there are any, they will simply be treated as text or blocks by the parser and will not belong to the node that represents the command or the start of the environment that preceeds them.
The few exceptions are either motivated by a technical necessity (such as parsing verbatim content, e.g., `\verb`) or by the need to parse mandatory or optional parameters for commands and envronments that can be visualised in transitionals (such as the settings and the path following the `\iincludegraphics` command).

All the production rules listed in the [`LatexParsers` type](src/core/ast/LatexParser.ts) generate a node in the AST.
Each rule is implemented in two ways in the `LatexParser` class: a _parser_ and a _reparser_:

- The parsers are meant to be used when parsing an entire file, e.g., after recompiling the document;
- The reparsers are meant to reparse a fragment of the file once it has been parsed into an AST node at least once, under the assumption that the fragment of the file still represents the same type of node.

Reparsers are used to update the AST when the content of the file is modified (as notified by the source file manager).
Beyond improving performance, this design allows to update a transitional when the code it represents is modified in real-time (e.g., after each keystroke), without having to parse the whole file again and to either (1) match old AST nodes with new AST nodes or (2) re-create all transitionals, at the risk of resetting the internal state of the transitional whose code is modified.
If the reparser fails (e.g., because the new content of the range of the AST node does not represent the same type of node anymore), the user has two options:

- They can keep editing the document, e.g., to fix a syntax error that was introduced in the last edit, until the reparser suceeds and generates a new valid AST node;
- They can recompile the document to generate new ASTs from scratch. This may be mandatory in some situations, such as if an edit crossed the range of the AST node of a transitional.



## Defining transitionals

Transitionals are implemented according to pattern inspired by to MVC.
Each transitional is split between a _model_ (executed in the core) and a _view_ (executed in the webview).
In addition, the model and the view act as controllers, as they both react to events and communicate with each other through asynchronous messages.

Transitionals have a number of important properties, which are used to identify and compare transitional-related objects throughout the code:

- Each type of transitional must have a unique _name_;
- each code mapping has a unique _code mapping ID_, which is shared by the model and the view and only changes when the file is recompiled (it persists across edits in the meantime);
- each model has a _unique identifier_ (UID), which changes every time the model is re-created (e.g., after the AST node it represents was reparsed and updated).

The responsabilities of a transitional are split between its model and its view.

On the one side, the _model_ of each transitional ([`TransitionalModel`](src/core/transitionals/TransitionalModel.ts)) is given an AST node to represent and is responsible for

- Extracting all the appropriate information from the node. For instance, this might be the path and the dimension for an image or the structure and the content of each cell for a table;
- Creating a data structure that contains all the information required by the view and that can be serialised (since the data must be sent to the view through message passing). At the moment, the format chosen for this data is HTML; but this might change, e.g., for JSON.
- Implementing handlers to process messages sent by the view and transform the underlying document (and more specifically, the fragment represented by the AST node) to reify interactions performed by the user in the view (e.g., resizing an image, reordering the columns of a table).

On the other side, the _view_ of each transitional ([`TransitionalView`](src/webview/transitionals/TransitionalView.ts)) is given a container to populate and is responsible for

- Processing the data sent by the model to turn it into appropriate data structures;
- Populating the container to display the interactive representation of the code that must be visualised using the DOM API;
- Notifying the model of events of interest (e.g., the size of an image or the content of a table cell has changed).

There is no single instance of a _controller_ in the traditional sense of the term since model and view objects exist in two separate processes that can only communicate through message passing.
Instead, for each transitional, the controller mainly takes the form of a number of objects and methods implemented in the model and the view.
They are used for sending and receiving messages and reacting to events (extension events in the model, DOM events in the view).

In order to make _i_-LaTeX easy to extend with new transitionals, the model and the view of each transitional are not directly instantiated by the objects that deal with transitionals in the core and in the webview.
Instead, they are created by special objects named providers:

- Each transitional must have a _model provider_ ([`TransitionalModelProvider`](src/core/transitionals/TransitionalModelProvider.ts)), which is responsible for providing tests checking whether the model it can create is fit for a given code mapping (`canProvideForCodeMapping`) and a given AST node (`canProvideForASTNode`);
- Similarly, each transitional must have a _view provider_ ([`TransitionalViewProvider`](src/webview/transitionals/TransitionalViewProvider.ts)), which is responsible for providing the name of the transitional it can create (`transitionalName`).

All the providers available in _i_-LaTeX are listed in [`model-providers.ts`](src/transitionals/model-providers.ts) and [`view-providers.ts`](src/transitionals/view-providers.ts).



## Creating transitional models from code mappings

Once all the source files referenced by code mappings have been created and parsed, the AST nodes that can benefit from transitionals can finally (1) be identified using the information contained in code mappings and (2) be used to create the models of the transitionals ([`TransitionaModel`](src/core/transitionals/TransitionalModel.ts)).
These tasks are under the responsibility of the transitional model manager ([`TransitionalModelManager`](src/core/transitionals/TransitionalModelManager.ts)).

The task of pairing certain nodes of each AST with appropriate models is delegated to an _extractor_ [`TransitionalModelExtractor`](src/core/transitionals/extractors/TransitionalModelExtractor.ts), which uses the list of all the model providers available in _i_-LaTeX ([`TRANSITIONAL_MODEL_PROVIDERS`](src/transitionals/model-providers.ts)).
The current algorithm iterates over all the source files and all the model providers and works in two phases:

1. First, the algorithm attempts to make _perfect mappings_. For each code mapping, it attempts to find the first AST node that (1) starts on the same line number as the one specified in the code mapping, (2) can be used by the current model provider, and (3) has not been used by another model provider. This last rule accounts for potential conflicts, e.g., if two AST nodes starting on the same line can be visualised by the same transitional.
2. Then, if there remains unused code mappings or unused AST node that can be used by the current model providers, some heuristics are used to create _approximate mappings_ to attempt to bypass errors found in some code mappings (such as incorrect line numbers). This technique has more or less success depending on the situation and might be made optional, improved or removed in the future.

Once all the models have been created, the model manager performs two last steps:

1. It starts observing each model for (1) metadata or (2) content changes, and notify the webview when it happens so that it can update itself;
2. It initialises each model by calling the `init` method, which calls the abstract `updateContentData` method. This abstract method must be implemented by each model and is responsible for (1) updating the data used by the model to generate content for the view and (2) signalling when the update finishes (whether it was successful or not) by emitting an event via `contentUpdateEndEventEmitter`, which further triggers events that signal content and/or metadata changes (which can now be caught by the model manager!).



## Exchanging messages with the webview

To facilitate message passing between views and models, communication endpoints between the core and the webview are both represented by an abstract _messenger_ ([`AbstractMessenger`](src/shared/messenger/AbstractMessenger.ts)), which is parametrised by the types of the messages it can send and receive.
It is concretised differently on the model side, in the core of the extension ([`Messenger`](src/core/webview/Messenger.ts)), and on the view side, in the webview ([`Messenger`](src/webview/Messenger.ts)).
Both messengers are managed by dedicated managers ([`WebviewManager`](src/core/webview/WebviewManager.ts) in the core, [`WebviewManager`](src/webview/WebviewManager.ts) in the webview).

The types of all the available messages are defined in [`messages.ts`](src/shared/messenger/messages.ts).
They include messages to tell the webview a new PDF is available (`UpdatePDFMessage`), update the metadata or the content of a transitional (`UpdateTransitionalMetadataMessage`, `UpdateTransitionalContentMessage`), and notify the model of a transitional of some event (`NotifyTransitionalModelMessage`).



## Displaying the PDF

The webview updates the PDF it displays every time it receives a message signalling that a new PDF is available (starting from the first successful compilation of the document).

The PDF manager ([`PDFManager`](src/webview/pdf/PDFManager.ts)) is responsible for loading the PDF file given its path (that must be in [the special path format used by Visual Studio Code](https://code.visualstudio.com/api/extension-guides/webview#loading-local-content)), displaying overlay user interface elements (such as the "Recompile" button and notification), and updating the availability of each _annotation mask_ (the elements with blue halos that display transitionals on click).

The rendering of the PDF and the extraction of the special annotations inserted by special commands and environments are performed page-by-page by PDF page renderers ([`PDFPageRenderer`](src/webview/pdf/PDFPageRenderer.ts)), which are orchestrated by a PDF renderer ([`PDFRenderer`](src/webview/pdf/PDFRenderer.ts)).
They re-render the PDF every time (1) the view is notified that a new PDF file is available or (2) the webview panel is resized.

Click handlers on annotation masks are installed by the PDF page renderer.
They emit a custom event on click ([`REQUEST_TRANSITIONAL_DISPLAY_EVENT`](src/webview/transitionals/TransitionalViewManager.ts)), which include contextual information ([`TransitionalDisplayRequest`](src/webview/transitionals/TransitionalViewManager.ts) such as the code mapping ID (to display the view of the right model) and the coordinates of the annotation mask of the page (to display the popup at the right position).



## Displaying transitionals

The events signalling that a transitional should be displayed are caught by a handler installed by the transitional view manager ([`TransitionalViewManager`](src/webview/transitionals/TransitionalViewManager.ts)), which uses the list of all the view providers available in _i_-LaTeX ([`TRANSITIONAL_VIEW_PROVIDERS`](src/transitionals/view-providers.ts)).

A request for displaying the view of a transitional is processed in several steps:

1. If a transitional is already displayed, it is removed from the webview;
2. The following conditions are verified:
    - The webview has received data and metadata for a transitional with the given code mapping ID;
    - The webview has a view factory for a transitional with the given name;
    - The transitional can be displayed (e.g., there is no reparsing error for the corresponding AST node).
3. A view is created by the factory using the appropriate data, metadata and context ([`TransitionalViewContext`](src/webview/transitionals/TransitionalViewContext.ts)), which includes information about the PDF and the annotation mask;
4. A popup ([`TransitionalPopup`](src/webview/transitionals/TransitionalPopup.ts)) is created and initialised with the data provided by the view. Each view must expose metadata used by the popup (such as the type of transitional and the file and range that contain the code represented by the transitional) as well as a `render` method, which must return a DOM node representing the view. In particular, it is used to populate the body of the popup when it is opened.

In addition to being provided with new metadata and new content received by the webview (`updateContentWith`, `updateMetadataWith`), the views are also equipped with a number of handlers for various events that may occur during their lifetime.
Some of them have a default behaviour, while some do nothing by default (see [`TransitionalView`](src/webview/transitionals/TransitionalView.ts) for details).
They enable to:

- Set up the view when it is created (`onBeforeTransitionalDisplay`, `onAfterTransitionalDisplay`);
- Clean up the view when it is deleted (`onBeforeTransitionalRemoval`, `onAfterTransitionalRemoval`);
- Update the view when it is replaced by an error (`onBeforeTransitionalErrorDisplay`, `onAfterTransitionalErrorDisplay`) or restored when the error is fixed (`onBeforeTransitionalErrorRemoval`, `onAfterTransitionalErrorRemoval`);
- Process a change of the size of the PDF (`onBeforePdfResize`, `onAfterPdfResize`).

Each view is also given a reference to the webview's messenger, which can be used to send messages to the model.



## Miscellaneous

### Code decorations

The code displayed in the code editor can be _decorated_ using Visual Studio Code's Decoration API.
In _i_-LaTeX, this is the responsibility of the decoration manager ([`DecorationManager`](src/core/decorations/DecorationManager.ts)).
By default, it only decorates the code of transitionals when they cannot be reparsed; but it can also be used to display more information, e.g., for debugging the abstract syntax tree (check the code that was commented out if you would like to enable this kind of decorations).



### Logging

_i_-LaTeX has a logging mechanism that can be used to record a number of events to run statistics or do user studies.
Each logged event is called a _log entry_ ([`LogEntry`](src/core/logs/LogEntry.ts)).
It is meant to be appended to a _log file_ ([`LogFile`](src/core/logs/LogFile.ts)), which is managed by a dedicated manager ([`LogFileManager`](src/core/logs/LogFileManager.ts)).

Log files can be written on the filesystem as CSV files (using the [`FileWriter`](src/core/utils/FileWriter.ts) utility).
_i_-LaTeX can write these log files in two places:

- In the same directory as the main LaTeX file of the logged document (_local_ log file);
- In a unique directory (which defaults to `~/.ilatex/logs/`), in a file named after a hash of the path of the main LaTeX file of the logged document (_centralised_ log file).

Modifying the settings of the extension allows to disable logging and customise a number of parameters (such as the path of the directory containing centralised log files and whether log files should be regular or hidden files).



### Tasks

_i_-LaTeX provides a concept of _task_, which is basically an asynchronous function (`() => Promise<void>`), along with runners which can execute them with different scheduling strategies:

- The task queuer ([`TaskQueuer`](src/shared/tasks/TaskQueuer.ts)) executes all the tasks it receives one after the other;
- The task throttler ([`TaskThrottler`](src/shared/tasks/TaskThrottler.ts)) waits a certain amount of time (`timeBetweenTasks`) after executing one task before running the next one;
- The task debouncer ([`TaskDebouncer`](src/shared/tasks/TaskDebouncer.ts)) waits a certain amount of time (`waitingTime`) when given a task (without executing it!) and only executes the last task received during that period of time (which may be different from the task that triggered that waiting period!).

> **Note:** these runners are not designed to be immune to race conditions due to the asynchronicity of the tasks they run and the timers they use.
> Future versions may further investigate these issues and consider relying on mechanisms such as mutexes (e.g., [https://github.com/DirtyHairy/async-mutex](https://github.com/DirtyHairy/async-mutex)).


### LaTeX lengths and parameters

_i_-LaTeX has some utilities that facilitate work with lengths and command/environment parameters.

#### Lengths

LateX lengths can be represented by [`LatexLength`](src/shared/latex-length/LatexLength.ts) objects.
They support the interpretation of _variable lengths_ (such as `em`) and _length macros_ (such as `\textwidth`), as long as their standard values have been configured in the settings of the length ([`LatexLengthSettings`](src/shared/latex-length/LatexLengthSettings.ts)).
The parser supports lengths that are encoded as `<value> <unit> <suffix>`, where:

- `value` is a number, or possibly empty if the unit is a length macro;
- `unit` is a string representing either (1) a standard unit or (2) an arbitrary length macro;
- `suffix` is an optional suffix. It is stored in the object but currently has no use. It was included to support the glue specification of rubber lengths using the `plus X minus Y` syntax (see, e.g., [http://latexref.xyz/Lengths.html](http://latexref.xyz/Lengths.html)).

Each element can be separated by an arbitrary number of whitespace characters. See the definition of the `parse` static method for details.

The value of the length is only _interpreted_ if and when the length must be converted to a different unit.
If this happens, there are two possibilities:

- If the source and target units are both constant units supported by `LatexLength` (`pt`, `bp`, `in`, `cm`, `mm`, `px`), they are readily converted;
- If either the source or the target unit is a variable length unit (`em`, `ex`) or a macro, the length can only be converted if the object is aware of the standard value of that unit/macro.

> **Note:** the value of `em`, `ex`, and a number of common length macros are exported along with other metadata in the code mappings written by the special commands and environments  `ilatex.sty` (you can easily edit this file to export more!).
> This information is parsed by the code mapping parser implemented in _i_-LaTeX and stored within _code mapping contexts_ objects ([`CodeMappingContext`](src/core/code-mappings/CodeMapping.ts)).

#### Parameters

LaTeX parameters are represented by [`LatexParameterAstNode`](src/core/utils/latex-parameters.ts) objects in the AST but can also be encapsulated into [`LatexParameter`](src/core/utils/latex-parameters.ts) objects, which pair the value of the parameter (of an arbitrary type) with the AST node (which only contains the content of the parameter as a string).
They also expose a `rawValue` property to easily export the value of a parameter in a serialisable format (e.g., to send the value of a parameter to the view of a transitional).
Implementations are provided for some common types (boolean, number, text and length).




# How to add a new transitional?

This sections contains a guide for implementing a new kind of transitional in _i_-LaTeX.
It complements the more detailed explanation of the code provided in the previous section, by focusing on the important steps that must be done.

Adding a new kind of transitional to _i_-LaTeX consists in three main steps:

1. Customising the LaTeX parser so that it recognises the fragments of code supported by the transitional;
2. Creating a new transitional model and registering its provider;
3. Creating a new transitional view and registering its provider.

Each step is explained in the following subsections.

> The template files located in the `src/transitionals/template` directory can be used as a starting point for creating a new transitional.
> You can copy it and inspect the files it contains to modify placeholders/add what is missing (often indicated by `TODO`s and comments).



## 1. Customising the LaTeX parser

In order to represent certain fragments of code through a transitional, _i_-LaTeX must be able to extract the appropriate information from the AST.
Since each transitional model corresponds to exactly one AST node, all the information required by your transitional should be captured in the AST node your model will get.
In particular, since _i_-LaTeX's parser has no knowledge about the mandatory (`{…}`) or optional (`[…]` parameters of the commands and environements it parses, they will be treated as independant AST nodes and will _not_ be part of the AST node representing the command (or the start of the environement) that preceeds them.

In order to pair these parameters with their command/environment node, the parser ([`LatexParser`](src/core/ast/LatexParser.ts)) must be modified so that when it encounteers a _specific_ command or the start of a _specific_ environment, it also looks for mandatory and/or optional parameters ahead.
These _specific_ command and environment have dedicated production rules in the language (see the `LatexParsers` type):

- The `specificEnvironment` rule specifies the parsers for specific environements (based on their names).
    - You can specify a list of mandatory and/or optional parameters (`parameters`). Their content can be parsed by an arbitrary parser, but they should always return an AST node that extends `ParameterNode`. By default, you can use the parser for generic parameters (`lang.parameter` rule).
    - You can specific a custom parser for the content of the environment. By default, you can use the parser for arbitrary LaTeX content (`lang.latex` rule).
- The `specificCommand` rule specifies the parsers for specific commands (based on their names). Just like with specific environements, you can specify a list of mandatory and/or optional parameters (`parameters`), with the same options.

If you want to support a new command or environment that has or may have parameters, you should modify one of these rules by specifying the syntax of your command/environement.
In addition, if you want to support a new environment, you must also add its name to the list defined in the `commandOrEnvironmment` rule (in the variable named `specificEnvironmentNames`). This is required to use the appropriate parser for your specific environement, in place of the generic one.

> If you wish to detect other kinds of syntactic structures than commands and environments, you may have to add new rules to the parser and define new kinds of AST nodes.
> While this is technically feasible, it is not covered in details in this guide!

## 2. Creating a new transitional model

### The model

Creating a new transitional model requires to define a class that extends the [`TransitionalModel`](src/core/transitionals/TransitionalModel.ts) abstract class.
You must implement the following members:

| Class member        | Description                                                                                                                                                                                                                                                                                                                 |
|---------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `transitionalName`  | A property or a getter that returns the name of the transitional (the same name than the one used in the view).                                                                                                                                                                                                             |
| `contentDataAsHtml` | A property or a getter that returns an HTML string representing the content of the transitional that must be sent to the view.                                                                                                                                                                                              |
| `updateContentData` | A method that updates the content of the model. This typically means re-extracting data from the AST node the model was given (as it may have changed since the last time it was interpreted). The method must return a Promise, which allows to perform asynchronous operations (such as reading the source file content). |

In addition, you may want to use or override the following members defined in the parent class:

- Various getters such as `sourceFile`, `codeMapping`, `astNode` and `codeRange`;
- `viewMessageHandlerSpecifications`, a method that returns an array of objects that specify all the handlers for the messages that may be sent by the view (a handler is used if its `title` property matches the `title` property of the `NotifyTransitionalModelMessage` instance received by the core);
- `registerChangeRequestedByTheView`, a method that must be called by the model if it makes changes in the source file that originate from a request from the view (e.g., because the user manipulated the transitional). It is used to know whether the document should be recompiled or not when the transitional is closed;
- `dispose`, a method that is called when models are disposed by the model manager. It can be extended to perform additional clean up (e.g., dispose of event handlers), but you should always call `super.dispose()` if you do so.

If you want to read or modify the content of the source file, you should use the appropriate methods provided by `SourceFile` (such as `getContent`, `createEditor` and `createTransientEditor`) and `ASTNode` (such as `setTextContent` and `deleteTextContent`).


### The model provider

In addition to the model itself, you must also define a class that implements the [`TransitionalModelProvider`](src/core/transitionals/TransitionalModelProvider.ts) interface.
You must implement the following members:

| Interface member           | Description                                                                                                          |
|----------------------------|----------------------------------------------------------------------------------------------------------------------|
| `canProvideForCodeMapping` | A method that takes a code mapping and asserts whether the model provided by this class can be used in this context. |
| `canProvideForASTNode`     | A method that takes an AST node and asserts whether the model provided by this class can represent it.               |
| `createModel`              | A method that creates and returns a new model.                                                                       |

Finally, you must instanciate a single instance of your model provider in the list of providers defined in the file located at `src/transitionals/model-providers.ts`.



## 3. Creating a new transitional view

### The view

Creating a new transitional model requires to define a class that extends the [`TransitionalView`](src/webview/transitionals/TransitionalView.ts) abstract class.
You must implement the following members:

| Class member        | Description                                                                                                                                                        |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `transitionalName`  | A property or a getter that returns the name of the transitional (the same name than the one used in the model).                                                                     |
| `render`            | A method that returns a DOM node representing the view, that will be inserted inside the body of the popup.                                                        |
| `updateContentWith` | A method that processes new content sent by the model. The content is provided as an HTML element, which is created by parsing the HTML string sent by the model.  |

In addition, you may want to use or override the following members defined in the parent class:

- Lifetime hooks such as `onAfterTransitionalDisplay` and `onBeforeTransitionalRemoval`, that can be used to set up/clean up DOM event handlers or to compute values that require the root node of the view to be attached to the DOM (e.g., the positions or the dimensions of an element). Do not forget to call the method as defined in the parent class first (with `super`), as some of these handlers have defaults behaviours that must be preserved;
- `messenger`, a reference to the webview messenger instance, that can be used to send messages to the model.


### The view provider

In addition to the view itself, you must also define a class that implements the [`TransitionalViewProvider`](src/webview/transitionals/TransitionalViewProvider.ts) interface.
You must implement the following members:

| Interface member   | Description                                                                                                       |
|--------------------|-------------------------------------------------------------------------------------------------------------------|
| `transitionalName` | A property or a getter that returns the name of the transitional the view provided by this class is designed for. |
| `createView`       | A method that creates and returns a new view.                                                                     |

Finally, you must instanciate a single instance of your view provider in the list of providers defined in the file located at `src/transitionals/view-providers.ts`.