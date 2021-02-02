import * as P from "parsimmon";
import { SourceFile } from "../mappings/SourceFile";
import { PositionInFile } from "../utils/PositionInFile";
import { RangeInFile } from "../utils/RangeInFile";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./nodes/ASTNode";
import { BlockNode } from "./nodes/BlockNode";
import { CommandNode } from "./nodes/CommandNode";
import { CommentNode } from "./nodes/CommentNode";
import { CurlyBracesParameterBlockNode } from "./nodes/CurlyBracesParameterBlockNode";
import { DisplayMathNode } from "./nodes/DisplayMathNode";
import { EnvironmentNode } from "./nodes/EnvironmentNode";
import { InlineMathNode } from "./nodes/InlineMathNode";
import { LatexNode } from "./nodes/LatexNode";
import { MathNode } from "./nodes/MathNode";
import { ParameterAssignmentNode } from "./nodes/ParameterAssignmentNode";
import { ParameterKeyNode } from "./nodes/ParameterKeyNode";
import { ParameterListNode } from "./nodes/ParameterListNode";
import { ParameterNode } from "./nodes/ParameterNode";
import { ParameterValueNode } from "./nodes/ParameterValueNode";
import { SpecialSymbolNode } from "./nodes/SpecialSymbolNode";
import { SquareBracesParameterBlockNode } from "./nodes/SquareBracesParameterBlockNode";
import { TextNode } from "./nodes/TextNode";
import { WhitespaceNode } from "./nodes/WhitespaceNode";


// General sets of characters
const alphanum = P.regexp(/[a-z0-9]+/i);
const alphastar = P.regexp(/[a-z]+\*?/i);

// Words written with regular characters and spaced by at most one whitespace char (\input)
const regularSentences = P.regexp(/([^\\\$&_%{}#\s]+(\s[^\\\$&_%{}#\s])?)+/i);

// Math block symbols
const dollar = P.string("$");
const singleDollar = dollar.notFollowedBy(dollar);
const doubleDollar = P.string("$$");

// Argument assignment symbols
const equal = P.string("=");
const comma = P.string(",");

// Braces
const openCurlyBracket = P.string("{");
const closeCurlyBracket = P.string("}");
const openSquareBracket = P.string("[");
const closeSquareBracket = P.string("]");

// Builders for parsers of common types of blocks
function wrapInCurlyBracesBlockParser<T>(parser: P.Parser<T>): P.Parser<[string, T, string]> {
    return P.seq(openCurlyBracket, parser, closeCurlyBracket);
}

function wrapInSquareBracesBlockParser<T>(parser: P.Parser<T>): P.Parser<[string, T, string]> {
    return P.seq(openSquareBracket, parser, closeSquareBracket);
}

// Unique symbol representing an empty AST node value
export const EMPTY_AST_VALUE: unique symbol = Symbol("Empty AST value");
export type EmptyASTValue = typeof EMPTY_AST_VALUE;

type CommandOrEnvironmentParameterBlock =
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
    | EmptyASTValue;

// Builder for parsers of command parameters,
// using a dedicated interface to specify them
interface ParameterSpecification {
    type: "curly" | "square";
    parser: P.Parser<ParameterNode | ParameterListNode>;
    optional?: boolean;
}

// Builder for parsers of commands
// (which can include 0+ mandatory and/or optional parameters)
interface CommandSpecification {
    name: string;
    nameParser?: P.Parser<string>; // use P.string(name) if absent
    parameters: ParameterSpecification[];
}

// Builder for parsers of environements
interface EnvironementSpecification {
    name: string;
    nameParser?: P.Parser<string>;  // use P.string(name) if absent
    parameters: ParameterSpecification[];
    contentParser: P.Parser<ASTNode>;
}

// Language of a simplified subset of LaTeX
// It can be parsed by using the 'latex' rule as the axiom of the grammar
type LatexParsersSpecification = {
    latex: LatexNode,
    text: TextNode,
    whitespace: WhitespaceNode,
    specificEnvironement: EnvironmentNode,
    anyEnvironement: EnvironmentNode,
    specificCommand: CommandNode,
    anyCommand: CommandNode,
    commandOrEnvironment: CommandNode | EnvironmentNode,
    math: MathNode,
    inlineMath: InlineMathNode,
    displayMath: DisplayMathNode,
    block: BlockNode,
    curlyBracesParameterBlock: CurlyBracesParameterBlockNode,
    parameter: ParameterNode,
    optionalParameter: ParameterNode,
    squareBracesParameterBlock: SquareBracesParameterBlockNode,
    parameterKey: ParameterKeyNode,
    parameterValue: ParameterValueNode,
    parameterAssignment: ParameterAssignmentNode,
    parameterList: ParameterListNode,
    specialSymbol: SpecialSymbolNode,
    comment: CommentNode
};

export class LatexParser {
    private readonly sourceFile: SourceFile;
    private readonly parsers: P.TypedLanguage<LatexParsersSpecification>;

    constructor(sourceFile: SourceFile) {
        this.sourceFile = sourceFile;
        this.parsers = this.createLanguageParsers();
    }

    private contextualiseParserOutput<ParserOutput, TransformerOutput extends ASTNode>(
        reparser: P.Parser<TransformerOutput>,
        transformer: (value: ParserOutput, context: ASTNodeContext, reparser: ASTNodeParser<TransformerOutput>) => TransformerOutput
    ) {
        const sourceFile = this.sourceFile;

        return function parserOutputContextualiser(parser: P.Parser<ParserOutput>) {
            const transformedParser: P.Parser<TransformerOutput> = P.seqMap(P.index, parser, P.index, (start, value, end) => {
                return transformer(
                    value,
                    {
                        sourceFile: sourceFile,
                        range: new RangeInFile(
                            PositionInFile.fromParsimmonIndex(start),
                            PositionInFile.fromParsimmonIndex(end),
                        )
                    },
                    (input: string) => reparser.parse(input) //as P.Result<TransformerOutput> // TODO: remove this cast?
                );
            });

            return transformedParser;
        };
    }

    private createParameterParsers(parameters: ParameterSpecification[]): P.Parser<CommandOrEnvironmentParameterBlock>[] {
        const parametersParsers = [];
        for (let parameter of parameters) {
            const parameterParser = (parameter.type === "curly")
                ? wrapInCurlyBracesBlockParser(parameter.parser) // TODO: fix
                    .thru(this.contextualiseParserOutput(this.parsers.curlyBracesParameterBlock, (value, context, parser) =>
                        new CurlyBracesParameterBlockNode(value[1], context, parser)
                    ))
                : wrapInSquareBracesBlockParser(parameter.parser) // TODO: fix
                    .thru(this.contextualiseParserOutput(this.parsers.squareBracesParameterBlock, (value, context, parser) =>
                        new SquareBracesParameterBlockNode(value[1], context, parser)
                    ));
            
            // If the argument is optional, the parser can be applied zero or one time
            // Otherwise, it must appear exactly one time
            const minNbTimes = parameter.optional ? 0 : 1;
            parametersParsers.push(
                // The cast seems required to make TypeScript understand that P.Parser<A> | P.Parser<B>
                // is, here, equivalent to P.Parser<A | B>
                (parameterParser
                    .times(minNbTimes, 1) as P.Parser<CurlyBracesParameterBlockNode[] | SquareBracesParameterBlockNode[]>)
                    .map(optionalASTNodeAsArray =>
                        optionalASTNodeAsArray.length === 1
                            ? optionalASTNodeAsArray[1]
                            : EMPTY_AST_VALUE
                    )
            );
        }
    
        return parametersParsers;
    }

    private createCommandParser(command: CommandSpecification): P.Parser<CommandNode> {
        const nameParser = command.nameParser ?? P.string(command.name);
        // const nameParserWithPositions = P.seq(P.index, nameParser, P.index);
    
        // Create an array of parsers for all the parameters
        const parametersParsers = this.createParameterParsers(command.parameters);
    
        // Return a parser which expects the command followed by all its parameters
        // (though optional ones may of course be absent)
        return P.seq(P.string("\\"), nameParser, ...parametersParsers)
            .thru(this.contextualiseParserOutput(
                this.parsers.anyCommand, // TODO: fix
                (value, context, reparser) => new CommandNode(value[1], value[2], context, reparser)
            ));
    }

    private createEnvironementParser(environement: EnvironementSpecification): P.Parser<EnvironmentNode> {
        const nameParser = (environement.nameParser ?? P.string(environement.name))
            .thru(this.contextualiseParserOutput(
                this.parsers.parameter, // TODO: fix
                (value, context, reparser) => new ParameterNode(value, context, reparser)
            ));
        
        // Create parsers for \begin and \end commands
        const beginParser = this.createCommandParser({
            name: "begin",
            parameters: [{
                type: "curly",
                parser: nameParser
            }]
        });
    
        const endParser = this.createCommandParser({
            name: "end",
            parameters: [{
                type: "curly",
                parser: nameParser
            }]
        });
    
        // Create parsers for the environement parameters
        const parametersParsers = this.createParameterParsers(environement.parameters);
    
        // Return a parser which expects the begin command, followed by all the env. parameters,
        // followed by the content of the environement, followed by the end command
        //const seq = P.seq as (...parsers: P.Parser<ASTNode>[]) => P.Parser<ASTNode[]>;
        return P.seq(
            beginParser,
            P.seq(...parametersParsers),
            environement.contentParser,
            endParser
        )
            .thru(this.contextualiseParserOutput(this.parsers.anyEnvironement, (value, context, reparser) => {
                // If a name parser is specified, use the value it output as the environement name
                // Otherwise, use the given name
                const name = (environement.nameParser
                    ? ((value[0].parameters[0] as CurlyBracesParameterBlockNode).content as ParameterNode).value
                    : environement.name);
                
                return new EnvironmentNode(
                    name,
                    value[0],
                    value[1],
                    value[2],
                    value[3],
                    context,
                    reparser
                );
            }));
    }

    private createLanguageParsers() {
        return P.createLanguage<LatexParsersSpecification>({
            text: lang => {
                return regularSentences
                    .thru(this.contextualiseParserOutput(this.parsers.text, (value, context, reparser) => new TextNode(value, context, reparser)));
            },
        
            whitespace: lang => {
                return P.whitespace
                    .thru(this.contextualiseParserOutput(this.parsers.whitespace, (value, context, reparser) => new WhitespaceNode(context, reparser)));
            },
            
            specificEnvironement: lang => {
                // Specifications of the environements of interest
                const specifiedEnvironements: EnvironementSpecification[] = [
                    {
                        name: "itabular",
                        parameters: [
                            { type: "curly", parser: lang.parameter }
                        ],
                        contentParser: lang.latex,
                    },
                    {
                        name: "itemize",
                        parameters: [],
                        contentParser: lang.latex
                    },
                    {
                        name: "gridlayout",
                        parameters: [
                            { type: "square", parser: lang.parameter, optional: true }
                        ],
                        contentParser: lang.latex,
                    },
                    {
                        name: "row",
                        parameters: [
                            { type: "curly", parser: lang.parameter }
                        ],
                        contentParser: lang.latex,
                    },
                    {
                        name: "cell",
                        parameters: [
                            { type: "curly", parser: lang.parameter }
                        ],
                        contentParser: lang.latex,
                    },
                    {
                        name: "imaths",
                        parameters: [],
                        contentParser: lang.latex,
                    }
                ];
        
                return P.alt(
                    ...specifiedEnvironements.map(environement => this.createEnvironementParser(environement))
                );
            },
        
            anyEnvironement: lang => {
                return this.createEnvironementParser({
                    name: "<non-specific environement>",
                    nameParser: alphastar,
                    parameters: [],
                    contentParser: lang.latex
                });
            },
        
            specificCommand: lang => {
                // Specifications of the commands of interest
                const specifiedCommands: CommandSpecification[] = [
                    {
                        name: "iincludegraphics",
                        parameters: [
                            {type: "square", parser: lang.parameterList, optional: true},
                            {type: "curly", parser: lang.parameter}
                        ]
                    },
                    {
                        name: "\\",
                        parameters: [
                            {type: "square", parser: lang.optionalParameter, optional: true}
                        ]
                    }
                ];
        
                return P.alt(
                    ...specifiedCommands.map(command => this.createCommandParser(command))
                );
            },
        
            anyCommand: lang => {
                return P.regexp(/\\(([^a-z])|(([a-z]+\*?)))/i)
                    .thru(this.contextualiseParserOutput(this.parsers.anyCommand, (value, context, reparser) => new CommandNode(
                        value.substr(1), // Ignore the the leading backslash
                        [], // An unspecified command always has no parameter
                        context,
                        reparser
                    )));
            },
        
            commandOrEnvironment: lang => {
                const specificEnvironementNames = ["itabular", "itemize", "gridlayout", "row", "cell", "imaths"];
                function isStartingWithSpecificEnvironementBeginning(input: string): boolean {
                    return specificEnvironementNames.some(name => input.startsWith(`begin{${name}}`));
                }
        
                const specificCommandNames = ["iincludegraphics", "\\"];
                function isStartingWithSpecificCommandName(input: string): boolean {
                    return specificCommandNames.some(name => input.startsWith(name));
                }
        
                // Define a custom Parsimmon parser which expects something starting with a backslash,
                // and either return a more-or-less specific command/emvironement parser
                // or fail if what follows the backslash was not expected here.
                // It does not consume any character, as it delegates the parsing to the parser it returns
                function selectCommandParser(): P.Parser<P.Parser<CommandNode>> {
                    const createParserSelector = (input: string, index: number) => {
                        if (input.charAt(index) !== "\\") {
                            return P.makeFailure(index, "\\<any command>");
                        }
        
                        const remainingInput = input.substring(index + 1);
        
                        // Case 1 — it is the beginning of an environement
                        if (remainingInput.startsWith("begin{")) {
                            // Case 1.1 — it is a specific environement (with a known name)
                            if (isStartingWithSpecificEnvironementBeginning(remainingInput)) {
                                return P.makeSuccess(index, lang.specificEnvironement);
                            }
        
                            // Case 1.2 — it is an unknown environement
                            return P.makeSuccess(index, lang.anyEnvironement);
                        }
        
                        // Case 2 — it is the end of an environement
                        // This should not happen: \end commands should only be read by env. parsers.
                        // They must NOT be consumed as regular commands; otherwise, env. parsers
                        // will not be able to read the \end command they expect!
                        else if (remainingInput.startsWith("end{")) {
                            return P.makeFailure(index, "\\<any command> (unexpected \\end)");
                        }
        
                        // Case 3 — it is a specific command (with a known name)
                        else if (isStartingWithSpecificCommandName(remainingInput)) {
                            return P.makeSuccess(index, lang.specificCommand);
                        }
        
                        // Case 4 — it is an unknown command
                        else {
                            return P.makeSuccess(index, lang.anyCommand);
                        }
                    };
                    
                    // The cast seems to be required to work around a weird typing issue
                    return P(createParserSelector as any);
                }
            
                return selectCommandParser().chain(parser => parser);
            },
        
            math: lang => {
                // TODO: allow math nodes to be regular Latex nodes?
                return P.alt(
                    lang.comment.map(c => c.content),
                    P.regexp(/[^$%]+/)
                )
                    .atLeast(1)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.math,
                        (value, context, reparser) => new MathNode(value.join(""), context, reparser)
                    ));
            },
        
            inlineMath: lang => {
                return P.seq(singleDollar, lang.math, singleDollar)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.inlineMath,
                        (value, context, reparser) => new InlineMathNode(value[1], context, reparser)
                    )); 
            },
        
            displayMath: lang => {
                return P.seq(doubleDollar, lang.math, doubleDollar)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.displayMath,
                        (value, context, reparser) => new DisplayMathNode(value[1], context, reparser)
                    )); 
            },
        
            block: lang => {
                // TODO: attempt to remove the cast
                const emptyStringParser = P.string("")
                    .map(_ => EMPTY_AST_VALUE) as P.Parser<EmptyASTValue>;
        
                return wrapInCurlyBracesBlockParser(lang.latex.or(emptyStringParser))
                    .thru(this.contextualiseParserOutput(
                        this.parsers.block,
                        (value, context, reparser) => new BlockNode(
                            value[1] === EMPTY_AST_VALUE ? [] : value[1].content,
                            context,
                            reparser
                        )
                    ));
            },
        
            curlyBracesParameterBlock: lang => {
                return wrapInCurlyBracesBlockParser(lang.parameter)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.curlyBracesParameterBlock,
                        (value, context, reparser) => new CurlyBracesParameterBlockNode(value[1], context, reparser)
                    ));
            },
        
            parameter: lang => {
                // TODO: use a more robust approach
                return P.regexp(/[^%}]*/)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.parameter,
                        (value, context, reparser) => new ParameterNode(value, context, reparser)
                    ));
            },
        
            optionalParameter: lang => {
                // TODO: use a more robust approach
                return P.regexp(/[^%\]]*/)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.optionalParameter,
                        (value, context, reparser) => new ParameterNode(value, context, reparser)
                    ));
            },
        
            // environementNameParameter: lang => {
            //     return alphastar;
            // },
        
            squareBracesParameterBlock: lang => {
                return wrapInSquareBracesBlockParser(lang.parameterList)
                .thru(this.contextualiseParserOutput(
                    this.parsers.squareBracesParameterBlock,
                    (value, context, reparser) => new SquareBracesParameterBlockNode(value[1], context, reparser)
                ));
            },
        
            parameterKey: lang => {
                return alphanum
                    .thru(this.contextualiseParserOutput(
                        this.parsers.parameterKey,
                        (value, context, reparser) => new ParameterKeyNode(value, context, reparser)
                    ));
            },
        
            parameterValue: lang => {
                // TODO: use a more robust approach
                return P.regexp(/[^,\]]+/m)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.parameterValue,
                        (value, context, reparser) => new ParameterValueNode(value, context, reparser)
                    ));
            },
        
            parameterAssignment: lang => {
                return P.seq(lang.parameterKey, equal.trim(P.optWhitespace), lang.parameterValue)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.parameterAssignment,
                        (value, context, reparser) => new ParameterAssignmentNode(
                            value[0],
                            value[2],
                            context,
                            reparser
                        )
                    ));
            },
        
            parameterList: lang => {
                return (P.alt(
                    lang.parameterAssignment,
                    lang.parameterValue,
                ) as P.Parser<ParameterAssignmentNode | ParameterValueNode>)
                    .sepBy(comma.trim(P.optWhitespace))
                    .thru(this.contextualiseParserOutput(
                        this.parsers.parameterList,
                        (value, context, reparser) => new ParameterListNode(value, context, reparser)
                    ));
            },
        
            specialSymbol: lang => {
                return P.alt(
                    P.string("&"),
                    P.string("_"),
                    P.string("#")
                )
                    .thru(this.contextualiseParserOutput(
                        this.parsers.specialSymbol,
                        (value, context, reparser) => new SpecialSymbolNode(value, context, reparser)
                    ));
            },
        
            comment: lang => {
                return P.regexp(/%.*/)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.comment,
                        (value, context, reparser) => new CommentNode(value, context, reparser)
                    ));
            },
        
            latex: lang => {
                return P.alt(
                    // Comments
                    lang.comment,
        
                    // Commands and environements
                    lang.commandOrEnvironment,
        
                    // Special blocks
                    lang.displayMath,
                    lang.inlineMath,
                    lang.block,
        
                    // Special symbols
                    lang.specialSymbol,
        
                    // Text and whitespace
                    lang.text,
                    lang.whitespace
                )
                    .atLeast(1)
                    .thru(this.contextualiseParserOutput(
                        this.parsers.latex,
                        (value, context, reparser) => new LatexNode(value, context, reparser)
                    ));
            }
        });
    }

    async parse(): Promise<P.Result<LatexNode>> {
        // TODO: get the file content in an async fashion here
        const input = this.sourceFile.readContentSync();
        return this.parsers.latex.parse(input);
    }
}


// Extensive list of parser names that are exposed outside of this file
// This seems required to bypass a TypeScript error related to a self-reference
// of the Parsimmon language defined above
// (probably due to the fact every parser receives an object of every parser as input)
// type ExposedParserNames =
//     | "latex"
//     | "text"
//     | "whitespace"
//     | "commandOrEnvironment"
//     | "math"
//     | "inlineMath"
//     | "displayMath"
//     | "block"
//     | "curlyBracesParameterBlock"
//     | "parameter"
//     | "optionalParameter"
//     | "squareBracesParameterBlock"
//     | "parameterKey"
//     | "parameterValue"
//     | "parameterAssignment"
//     | "parameterList"
//     | "specialSymbol"
//     | "comment";

/*
 * Dictionnary of parsing functions for the simplified LaTeX language.
 * For the actual implementation, see the def. of Parsimmon language.
 */
// const latexParsers: {
//     [K in ExposedParserNames]: (input: string) => P.Result<LanguageParsersOutput[K]>;
// } = {
//     latex: language.latex.parse,
//     text: language.text.parse,
//     whitespace: language.whitespace.parse,
//     commandOrEnvironment: language.commandOrEnvironment.parse,
//     math: language.math.parse,
//     inlineMath: language.inlineMath.parse,
//     displayMath: language.displayMath.parse,
//     block: language.block.parse,
//     curlyBracesParameterBlock: language.curlyBracesParameterBlock.parse,
//     parameter: language.parameter.parse,
//     optionalParameter: language.optionalParameter.parse,
//     squareBracesParameterBlock: language.squareBracesParameterBlock.parse,
//     parameterKey: language.parameterKey.parse,
//     parameterValue: language.parameterValue.parse,
//     parameterAssignment: language.parameterAssignment.parse,
//     parameterList: language.parameterList.parse,
//     specialSymbol: language.specialSymbol.parse,
//     comment: language.comment.parse
// };

// const latexParsers2: {
//     [K in ExposedParserNames]: P.Parser<LanguageParsersOutput[K]>;
// } = {
//     latex: language.latex,
//     text: language.text,
//     whitespace: language.whitespace,
//     commandOrEnvironment: language.commandOrEnvironment,
//     math: language.math,
//     inlineMath: language.inlineMath,
//     displayMath: language.displayMath,
//     block: language.block,
//     curlyBracesParameterBlock: language.curlyBracesParameterBlock,
//     parameter: language.parameter,
//     optionalParameter: language.optionalParameter,
//     squareBracesParameterBlock: language.squareBracesParameterBlock,
//     parameterKey: language.parameterKey,
//     parameterValue: language.parameterValue,
//     parameterAssignment: language.parameterAssignment,
//     parameterList: language.parameterList,
//     specialSymbol: language.specialSymbol,
//     comment: language.comment
// };

// export { latexParsers, latexParsers2 };