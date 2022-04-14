# General information

## Structure of the repository

This repository is organised according to the following architecture:

| Directory     | Description                                                  |
|---------------|--------------------------------------------------------------|
| `demo`        | LaTeX documents that can be used to try or demo ilatex.      |
| `latex`       | LaTeX-related files used by ilatex (including `ilatex.sty`). |
| `misc`        | Miscellaneous (e.g., user guide, screenshots).               |
| `snippets`    | Code snippets for ilatex.                                    |
| `src`         | Source code of the Visual Studio Code extension.             |
| `node_module` | Dependencies installed by ther package manager.              |
| `out`         | JavaScript output of the code (compiled from TypeScript).    |

The root directory also contains a number of configuration files:

| File                                | Description                                                                                                                           |
|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `demo`                              |                                                                                                                                       |
| `rollup-plugin-template-inliner.js` | A custom Rollup plugin for inlining JavaScript and CSS files in an HTML file.                                                         |
| `rollup.config.js`                  | The configuration of Rollup, a JavaScript bundler used to package all the webview's code into a single HTML file.                     |
| `package.json`                      | The manifest of the extension, which includes metadata (name, version, authors, etc), contribution points, scripts, and dependencies. |
| `tsconfig.json`                     | The root configuration of the TypeScript compiler.                                                                                    |
| `tsconfig.core.json`                | The configuration of the TypeScript compiler for the _core_ part of the extension (compiled for a Node.js environement).              |
| `tsconfig.webview.json`             | The configuration of the TypeScript compiler for the _webview_ part of the extension (compiled for a web environement).               |
| `.vscodeignore`                     | The list of files and directories that must **not** be included in the Visual Studio Code extension.                                  |

Other files and directories include configuration files for Git, GitHub Workflows and ESLint.

The code of the extension is organised into two different parts called the **core** and the **webview**.
This separation is due to a technical constraint imposed by Visual Studio Code: the extension itself is executed in a Node.js environement, but the code of the webview (i.e., the part where the PDF is rendered) is executed in a web environement, in a separate process; and the two parts can only communicate through message passing.

This division implies that the code of the core and the code of the webview must be compiled and bundled in different ways.
Some parts of the code are compiled for a Node.js environement (as specified in `tsconfig.core.json`), while some other parts are compiled for a web environement (as specified in `tsconfig.webview.json`).
For this reason, the `src` directory is subdivided into the four following subdirectories:

- The `core` subdirectory contains files used by the core (compiled for Node.js);
- The `webview` subdirectory contains files used by the webview (compiled for the web);
- The `shared` subdirectory contains files that can be used in both the core and the webview;
- The `visualisations` subdirectory contains one directory per transitional. Each of them must contain two directories: one for the model (`model`), which is only included in the core, and one for the view (`view`), which is only included in the webview.

In addition, the `webview/template` and `visualisations/*/view` directories can contain a `static` directory, which is meant to contain JavaScript (in a `js` directory) and CSS (in a `css` directory) files that must be included in the code of the webview, which is turned into a single HTML file during the build process.



## Build process

To build the extension for Visual Studio Code, the code of ilatex must be compiled and bundled into a single .vsce file.
In order to do this, the following steps must be performed:

1. The code of the webview must be compiled (from TypeScript to JavaScript);
2. The resulting JavaScript, along with static JavaScript libraries and CSS files, must be inlined into a single HTML file;
3. The code of the core must be compiled (from TypeScript to JavaScript);
4. The code must be bundled into an `ilatex.vsce` file using the `vsce` utility.

The scripts defined in `package.json` can be used to perform these steps.
Steps 1 to 3 can be performed by running the `build` command, and step 4 can be performed by running the `package` command (e.g., `yarn run build && yarn run package`).



## Dependencies

### External dependencies

Since _i_-LaTeX is implemented as an extension for the Visual Studio Code, it must be installed on a sufficiently recent version of the editor.
In addition, a recent distribution of LaTeX must be installed.
It must include the packages required by [`ilatex.sty`], as well as the `latexmk` utility, which must be available via a terminal, as it is used internally by ilatex to compile LaTeX documents.


### Internal dependencies

Internally, ilatex uses a number of dependencies listed in `package.json` and managed by a package manager such as `yarn` or `npm`.
After cloning the repository, you can install them by running `yarn` or `npm install`.

In addition, the webview uses several libraries that are not specified in `package.json`.
This choice was motivated by two reasons:

- Rollup has not been configured to search packages in `node_modules` when packaging the webview's code;
- Some libraries (KaTeX, Handsontable) have been manually fixed/customised.





# How does _i_-LateX works?

## Special LaTeX commands and environments

As explained in [_i_-LaTeX's user guide](./misc/user-guide.pdf), transitionals are only available for _special_ commands and environements, which must be used in place of their counterparts.
For instance, in order to use the interactive grid provided by the transitional for tables, one must use the `itabular` environment instead of the regular `tabular` environment.

This requirement is due to the fact that using these special commands have two additional side effects that are required for ilatex's to work:

- they surround the content they generate with a PDF annotation tagged with a unique ID;
- they append an entry to an external file of _code mappings_ (`<main file name>.ilatex-mappings`), which contains the same ID along with other medadata (file name, position in the file, type of content, normalised value of several length macros and units, etc).

Note that regular commands and environements can also be patched to produce the same side effects!
It was not done in this prototype, because patching commands such as `\includegraphics` was more tricky than expected, and the way these side effects are currently implemented may break other commands and environments, but it is technically feasible.

In the current implementation, these special commands and environments are defined in the [`ilatex.sty`] LaTeX package, which must be imported in a LaTeX document to make it benefit from transitionals.
The package also performs a few other housekeeping tasks, such as creating a counter for the unique IDs, creating the file of code mappings, and patching the `\graphicspath` commands to collect the list of paths that can be used with `\includegraphics`. 



## Starting the extension

The entry point of the extension is [`extension.ts`], as specified in the [`package.json`] manifest, along with a number of contributions points.
The contribution points describe the commmands (e.g., to open and close a LaTeX document with ilatex), code snippets (defined in [`snippets/ilatex.json`]) and settings (e.g., enable/disable logging, specify extra arguments for `latexmk`) that are provided by ilatex.

The only role of `extension.ts` is to export `activate` and `deactivate` functions, which are executed by Visual Studio Code when loading/unloading the extension.
The actual initialisation is delegated to a `InteractiveLatexExtensionContext` singleton, which sets up the integration of ilatex in Visual Studio Code (e.g., defining the commands described by the contribution points, adding UI elements).
The management of the LaTeX document themselves is further delegated to an instance of `InteractiveLatexDocumentManager`, which is reponsible for creating and deleting one instance of `InteractiveLatex` for each unique path to a main LaTeX file.

`InteractiveLatex` represents a single latex document opened with ilatex.
It owns a number of managers, with different concerns, which all keep a reference to their parent `InteractiveLatex` instance, so that they can directly access the other managers' APIs.



## Initialising the webview

The webview of each LaTeX document is created by `InteractiveLatexDocumentManager` during their instanciation (using the `createWebview` function).
However, the webview does not contain anything by default, and the only way to set its content provided by the Visual Studio Code API is to replace the content of the entire HTML page displayed by the webview.
This is why (1) the code is separated between the _core_ and the _webview_ and (2) all the files used by the webview must be inlined into a single HTML file (`out/webview/webview.inlined.html`), so that the core can read it once and use it to initialise the webview.
In ilatex, this is the responsability of the webview manager (`WebviewManager`) of each LaTeX document (using the `setInitialWebviewHtml` method).
Once both the core and the webview are initialised, they can communicate to exchange information and update each other, without having to change the code of the entire webpage each time (see the _Communication between the core and the webview_ section for more details).



## Compiling LaTeX documents

When a LaTeX document is opened or saved with ilatex, it is (re)compiled by ilatex to produce (1) a new PDF document and (2) a new file of code mappings.
The compilation is handled by the PDF manager ([`PDFManager`]) of the corresponding `InteractiveLatex` instance.
It creates a virtual terminal, uses it to run the `latexmk` utility on the main LaTeX file with a number of arguments, and waits for its completion.

If the compilation succeeds, the webview manager ([`WebviewManager`]) sends the new PDF to the webview, which is responsible for loading and displaying it.
If the compilation fails, an error message is displayed by the PDF manager.



## Reading source files and code mappings

Once the document has been recompiled, the code mapping manager ([`CodeMappingManager`]) is responsible of reading the file of code mappings (generated by the LaTeX compiler) and creating objects representing all the code mappings ([`CodeMapping`]).
From there, the source file manager ([`SourceFileManager`]) creates an object representing a source file (`SourceFile`) for each unique path in all the code mapping objects.

Internally, sources files are represented by two different structures: a text document representing the content of the file ([`TextDocument`] objects provided by Visual Studio Code), and an abstract syntax tree (AST) representing the structure of the code ([`LatexAST`]).
They are related to a number of other concepts, including _positions_ and _ranges_ in the file ([`SourceFilePosition`], [`SourceFileRange`]), two kinds of _editors_ for performing edits ([`AtomicSourceFileEditor`], [`LightweightSourceFileEditor`]), and _changes_ in the file ([`SourceFileChange`]), which are used in various locations in the code, as they are helpful for manipulating source files.
Changes are detected by the source file manager, logged if required, and forwarded to the AST.


[TODO: MENTION POSITION SHIFTING AND CLARIFY THE PURPOSES OF THE TWO TYPES OF EDITORS]



## Working with abstract syntax trees

While the interface with the file system is delegated to Visual Studio Code, which is responsible for reading and writing the content of each source file, the construction and the management of the syntactic structure of each source file is performed by ilatex.

Unlike most programming languages, LaTeX has no predefined grammar; and there is no way to build a parser accepting all the LaTeX documents that compile using traditionnal parser generators, as explained here.
However, by making a number of assumptions, such as `\` representing the start of a macro and the structure of environments, it is possible to create a parser that accepts a large subset of all valid LaTeX documents, though it may fail in certain situations.
To maximise parsing success, and unlike more specialised parsers (such as those of [KaTeX] and [MathJax] for mathematics), ilatex uses a fairly high-level grammar, with mostly generic nodes.
In our experience, this makes the parser more robust for parsing files that mainly contain content (which is what current transitionals are designed for), in contrast with files with a lot of macro definitions, low-level TeX syntax, etc.

Each file is represented by an abstract syntax tree ([`LatexAST`]), which contains a hierarchical structure of nodes that all extend the same class ([`ASTNode`]).
Most commands and environments are represented by generic nodes ([`CommandNode`], [`EnvironmentNode`]), with no parameter.
If there are any, they will simply be treated as text or blocks by the parser, and will not belong to the node that represents the command or the start of the environement that preceeds them.
The few exceptions are either motivated by a technical necessity (such as parsing verbatim content, e.g., `\verb`) or by the need to parse mandatory or optional parameters for commands and envronments that can be visualised in transitionals (such as the settings and the path following the `\iincludegraphics` command).

All the production rules listed in the `LatexParsers` type generate a node in the AST.
Each rule is implemented in two ways in the `LatexParser` class: a _parser_, and a _reparser_:

- The parsers are meant to be used when parsing an entire file, e.g., after recompiling the document;
- The reparsers are meant to re-parse a fragment of the file once it has been parsed into an AST node at least once, under the assumption that the fragment of the file still represents the same type of node.

Reparsers are used to update the AST when the content of the file is modified (as notified by the source file manager).
Beyond improving performance, this design enables to update a transitional when the code it represents is modified in real time (e.g., after each keystroke), without having to parse the whole file again and to either (1) match old AST nodes with new AST nodes or (2) re-create all transitionals, at the risk of resetting the internal state of the transitional whose code is modified.
If the reparser fails (e.g., because the new content of the range of the AST node does not represent the same type of node anymore), the user has two options:

- They can keep editing the document, e.g., to fix a syntax error that was introduced in the last edit, until the reparser suceeds and generates a new valid AST node;
- They can recompile the document to generate new ASTs from scratch. This may be mandatory in some situations, such as if an edit crossed the range of the AST node of a transitional.



## Defining transitionals

**[TODO: ADD AN INTRO HERE]**

Transitionals are organised under a pattern similar to MVC: they all have a model, a view, and a controller for reacting to events and communicate through message passing mediated by a controller.
Each type of transitional must have a unique _name_.
In addition:

- each model-view couple (corresponding to one code mapping) share the same _code mapping ID_, which only changes when the file is recompiled, and persists accross changes in the meantime;
- each model has _unique identifier_ (UID), which changes every time the model is re-created (e.g., after the AST node it represents was reparsed and updated).

On the one side, the _model_ of each transitional ([`VisualisationModel`]) is given an AST node to represent and is responsible for

- Extracting all the appropriate information from the node. For instance, this might be the path and the dimension for an image, or the structure and the content of each cell for a table;
- Creating a data structure that contains all the information required by the view and that can be serialised, since the data must be sent to the view through message passing. At the moment, the format chosen for this data is HTML; but this might change, e.g., for JSON.
- Implementing handlers to process messages sent by the view and transform the underlying document (and more specifically the fragment represented by the AST node) to reify interactions performed by the user in the view (e.g., resizing an image, reordering the columns of a table).

On the other side, the _view_ of each transitional ([`VisualisationView`]) is given a container to populate and is responsible for

- Processing the data sent by the model, to turn it into appropriate data structures;
- Populating the container to display the interactive representation of the code that must be visualised using the DOM API;
- Notifying the model of events of interest (e.g., the size of an image or the content of a table cell has changed).

There is no single instance of a _controller_ in the traditional sense of the term, since model and view objects exist in two separate processes that can only communicate through message passing.
Instead, for each transitional, the controller mainly takes the form of a number of objects and methods used for sending and receiving messages and reacting to events (extension events in the model, DOM events in the view).
To facilitate message passing between views and models, communication endpoints between the core and the webview are both represented by a single abstract class ([`AbstractMessenger`]), which is concretised differently on the model side ([`WebviewMessenger`]) and on the view side ([`Messenger`]).

In order to make ilatex easy to extend with new transitionals, the model and the view of each transitional are not directly instanciated by the objects that deal with transitionals in the core and in the webview.
Instead, they are created by special objects named model providers and view factories:

- Each transitional must have a _model provider_ ([`VisualisationModelProvider`]), which is responsible for providing tests checking whether the model it can create is fit for a given code mapping (`canProvideForCodeMapping`) and a given AST node (`canProvideForASTNode`);
- Similarly, each transitional must have a _view factory_ ([`VisualisationViewFactory`]), which is responsible for creating a view for a transitional with a given name (`visualisationName`) on demand.



## Creating transitional models from code mappings

Once all the source files referenced by code mappings have been created and parsed, the AST nodes that can benefit from transitionals can finally (1) be identified using the information contained in code mappings and (2) be used to create the models of the transitionals ([`VisualisationModel`], [`AbstractVisualisationModel`]).
These tasks are under the responsability of the visualisation model manager ([`VisualisationModelManager`]).

The task of pairing certain nodes of each AST with appropriate models is delegated to an instance of [`VisualisationModelExtractor`], which contains a static list of all the model providers available in ilatex (`MODEL_PROVIDERS`).
The current algorithm iterates over all the source files and all the model providers.
It works in two phases:

1. First, the algorithm attempts to make _perfect mappings_. For each code mapping, it attempts to find the first AST node that (1) starts on the same line number than the one specified in the code mapping, (2) can be used by the current model provider, and (3) has not been used by another model provider. This last rule accounts for potential conflicts, e.g., if two AST nodes starting on the same line can be visualised by the same transitional.
2. Then, if there remains unused code mappings or unused AST node that can be used by the current model providers, some heuristics are used to create _approximate mappings_, in an attempt to bypass errors found in some code mappings (such as incorrect line numbers). This technique has more or less success depending on the situation, and might be made optional, improved or removed in the future.

Once all the models have been created, the model manager performs two last steps:

1. It starts observing each model for (1) metadata or (2) content changes, and notify the webview when it happens, so that it can update itself;
2. It initialises each model ([`init`]), which calls the abstract [`updateContentData`] method. This abstract method must be implented by each model and is responsible for (1) updating the data used by the model to generate content for the view and (2) signalling when the update finishes (whether it was successful or not) by emitting an event via `contentUpdateEndEventEmitter`, which further triggers events that signal content and/or metadata changes (which can now be caught by the model manager!).



## Exchanging messages with the webview

To facilitate message passing between views and models, communication endpoints between the core and the webview are both represented by an abstract _messenger_ ([`AbstractMessenger`]), which is parametrised by the types of the messages it can send and receive.
It is concretised differently on the model side, in the core of the extension ([`WebviewMessenger`]), and on the view side, in the webview ([`Messenger`]).
Both messengers are managed by dedicated managers ([`WebviewManager`] in the core, [`WebviewManager`] in the webview).

The types of all the available messages are defined in [`messages.ts`].
They include messages to tell the webview a new PDF is available ([`UpdatePDFMessage`]), update the metadata or the content of a transitional ([`UpdateVisualisationMetadataMessage`], [`UpdateVisualisationContentMessage`]), and notify the model of a transitional of some event ([`NotifyVisualisationModelMessage`]).



## Displaying the PDF

The webview updates the PDF it displays every time it receives a message signalling that a new PDF is available (starting from the first successful compilation of the document).

The PDF manager ([`PDFManager`]) is responsible for loading the PDF file given its path (that must be in [the special path format used by Visual Studio Code](https://code.visualstudio.com/api/extension-guides/webview#loading-local-content)), displaying overlay user interface elements (such as the "Recompile" button and notification), and updating the availability of each _annotation mask_ (the elements with blue halos that display transitionals on click).

The rendering of the PDF and the extraction of the special annotations inserted by special commands and environments are performed page-by-page by PDF page renderers ([`PDFPageRenderer`]), which are orchestrated by a PDF renderer ([`PDFRenderer`]).
They re-render the PDF every time (1) the view is notified that a new PDF file is available or (2) the webview panel is resized.

Click handlers on annotation masks are installed by the PDF page renderer.
They emit a custom event on click ([`REQUEST_VISUALISATION_DISPLAY_EVENT`]), which include contextual information ([`VisualisationDisplayRequest`]) such as the code mapping ID (to display the view of the right model) and the coordinates of the annotation mask of the page (to display the popup at the right position).



## Displaying transitionals

The events signalling that a transitional should be displayed are caught by a handler installed by the visualisation view manager ([`VisualisationViewManager`]), which contains a static list of all the view factories available in ilatex (`AVAILABLE_VISUALISATION_FACTORIES`).

A request for displaying the view of a transitional is processed in several steps:

1. If a transitional is already displayed, it is removed from the webview;
2. The following conditions are verified:
    - The webview has received data and metadata for a transitional with the given code mapping ID;
    - The webview has a view factory for a transitional with the given name;
    - The transitional can be displayed (e.g., there is no reparsing error for the corresponding AST node).
3. A view is created by the factory using the appropriate data, metadata and context ([`VisualisationViewContext`]), which includes information about the PDF and the annotation mask;
4. A popup ([`VisualisationPopup`]) is created and initialised with the data provided by the view. Each view must expose metadata used by the popup (such as the type of visualisation and the file and range that contain the code represented by the transitional) as well as a `render` method, which must return a DOM node representing the view. In particular, it is used to populate the body of the popup when it is opened.

In addition to being provided with new metadata and new content received by the webview (`updateContentWith`, `updateMetadataWith`), the views are also equipped with a number of handlers for various events that may occur during their lifetime.
Some of them have a default behaviour, while some do nothing by default (see [`AbstractVisualisationView`] for details).
They enable to:

- Set up the view when it is created (`onBeforeVisualisationDisplay`, `onAfterVisualisationDisplay`);
- Clean up the view when it is deleted (`onBeforeVisualisationRemoval`, `onAfterVisualisationRemoval`);
- Update the view when it is replaced by an error (`onBeforeVisualisationErrorDisplay`, `onAfterVisualisationErrorDisplay`) or restored when the error is fixed (`onBeforeVisualisationErrorRemoval`, `onAfterVisualisationErrorRemoval`);
- Process a change of the size of the PDF (`onBeforePdfResize`, `onAfterPdfResize`).

Each view is also given a reference to the webview's messenger, which can be used to send messages to the model.



## Miscellaneous

### Code decorations

The code displayed in the code editor can be _decorated_ using Visual Studio Code's Decoration API.
In ilatex, this is the responsability of the decoration manager ([`DecorationManager`]).
By default, it only decorates the code of transitionals when they cannot be reparsed; but it can also be used to display more information, e.g., for debugging the abstract syntax tree (check the code that was commented out if you would like to enable this kind of decorations).



### Logging

ilatex has a logging mechanism which can be used to record a number of events to run statistics or do user studies.
Each logged event is called a _log entry_ ([`LogEntry`]).
It is meant to be appended to a _log file_ ([`LogFile`]), which is managed by a dedicated manager ([`LogFileManager`]).

Log files can be written on the filesystem as CSV files (using the [`FileWriter`] utility).
ilatex can write these log files in two places:

- In the same directory as the main LaTeX file of the logged document (_local_ log file);
- In a unique directory (which defaults to `~/.ilatex/logs/`), in a file named after a hash of the path of the main LaTeX file of the logged document (_centralised_ log file).

Modifying the settings of the extension allows to enable/disable logging, as well as to customise a number of parameters (such as the path of the directory containing centralised log files and whether log files should be regular or hidden files).



### Tasks

ilatex provides a concept of _task_, which is basically an asynchronous function (`() => Promise<void>`), along with runners which can execute them with different scheduling strategies:

- The task queuer ([`TaskQueuer`]) executes all the tasks it receives one after the other;
- The task throttler ([`TaskThrottler`]) waits a certain amount of time (`timeBetweenTasks`) after executing one task before running the next one;
- The task debouncer ([`TaskDebouncer`]) waits a certain amount of time (`waitingTime`) when given a task (without executing it!), and only executes the last task received during that period of time (which may be different from the task that triggered that waiting period!).

> **Note:** these runners are not designed to be immune to race conditions due to the asynchronicity of the tasks the run and the timers they use.
> Future versions may further investigate these issues and consider relying on mechanisms such as mutexes (e.g., [https://github.com/DirtyHairy/async-mutex](https://github.com/DirtyHairy/async-mutex)).


### LaTeX lengths and parameters

ilatex has some utilities that facilitate work with lengths and command/environment parameters.

#### Lengths

LateX lengths can be represented by [`LatexLength`] objects.
They support the interpretation of _variable lengths_ (such as `em`) and _length macros_ (such as `\textwidth`), as long as their standard values have been configured in the settings of the length (`LatexLengthSettings`).
The parser supports lengths that are encoded as `<value> <unit> <suffix>`, where:

- `value` is a number, or possibly empty if the unit is a length macro;
- `unit` is a string representing either (1) a standard unit or (2) an arbitrary length macro;
- `suffix` is an optional suffix. It is stored in the object, but currently has no use. It was included to support glue specification of rubber lengths using the `plus X minus Y` syntax (see, e.g., [http://latexref.xyz/Lengths.html](http://latexref.xyz/Lengths.html)).

Each element can be separated by an arbitrary number of whitespace characters. See the definition of the `parse` static method for details.

The value of the length is only _interpreted_ if and when the length must be converted to a different unit.
If this happens, there are two possibilities:

- If the source and target units are both constant units supported by `LatexLength` (`pt`, `bp`, `in`, `cm`, `mm`, `px`), they are readily converted;
- If either the source or the target unit is a variable length unit (`em`, `ex`) or a macro, the length can only be converted if the object is aware of the standard value of that unit/macro.

> **Note:** the value of `em`, `ex`, and a number of common length macros are exported along with other metadata in the code mappings written by the special commands and environments  `ilatex.sty` (you can easily edit this file to export more!).
> This information is parsed by the code mapping parser implemented in ilatex and stored within _code mapping contexts_ objects (`CodeMappingContext`).

#### Parameters

LaTeX parameters are represented by [`LatexParameterAstNode`] objects in the AST, but can also be encapsulated into [`LatexParameter`] objects, which pair the value of the parameter (of an arbitrary type) with the AST node (which only contains the content of the parameter as a string).
They also expose a `rawValue` property to easily export the value of a parameter in a serialisable format (e.g., to send the value of a parameter to the view of a transitional).
Implementations are provided for some common types (boolean, number, text and length).




# How to add a Transitional

TODO