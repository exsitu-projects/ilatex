# Interactive LaTeX

This repository contains a Visual Studio Code (VSC) extension developed to test prototypes of interactive intermediate visualisations for LaTeX code (_e.g._ displaying the content of the cells defined in the `tabular` environement using a table layout).

It is written in TypeScript, using a baisc VSC extension template. The extensions relies on [`Parsimmon`](https://github.com/jneen/parsimmon) to parse a simplified LaTeX subset.


## Build instructions
The extension can be easily built and tested using VSC:
- Clone this repository (`git clone git@bitbucket.org:daru13/interactive-latex.git`);
- Open it in VSC (`code <repo. directory>`);
- Start the debugger to compile and test the extension (F5).