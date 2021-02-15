import * as P from "parsimmon";
import Parsimmon = require("parsimmon");
import { SourceFile } from "../source-files/SourceFile";
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
const alphastar = P.regexp(/[a-z]+\**/i);

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

type LatexReparsers = {[K in keyof LatexParsersSpecification]: ASTNodeParser<LatexParsersSpecification[K]> };

export class LatexParser {
    private readonly sourceFile: SourceFile;
    private readonly parsers: P.TypedLanguage<LatexParsersSpecification>;
    private readonly reparsers: LatexReparsers;

    constructor(sourceFile: SourceFile) {
        this.sourceFile = sourceFile;
        this.parsers = this.createLanguageParsers();
        this.reparsers = this.createReparsers();
    }

    private contextualiseParserOutput<ParserOutput, TransformerOutput extends ASTNode>(
        reparser: ASTNodeParser<TransformerOutput>,
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
                    reparser
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
                    .thru(this.contextualiseParserOutput(this.reparsers.curlyBracesParameterBlock, (value, context, reparser) =>
                        new CurlyBracesParameterBlockNode(value[1], context, reparser)
                    ))
                : wrapInSquareBracesBlockParser(parameter.parser) // TODO: fix
                    .thru(this.contextualiseParserOutput(this.reparsers.squareBracesParameterBlock, (value, context, reparser) =>
                        new SquareBracesParameterBlockNode(value[1], context, reparser)
                    ));
            
            // If the argument is optional, the parser can be applied zero or one time
            // Otherwise, it must appear exactly one time
            const minNbTimes = parameter.optional ? 0 : 1;
            parametersParsers.push(
                // The cast seems required to make TypeScript understand that here,
                // P.Parser<A> | P.Parser<B> is equivalent to P.Parser<A | B>
                (parameterParser.times(minNbTimes, 1) as P.Parser<CurlyBracesParameterBlockNode[] | SquareBracesParameterBlockNode[]>)
                    .map(optionalASTNodeAsArray =>
                        optionalASTNodeAsArray.length === 1
                            ? optionalASTNodeAsArray[0]
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
        return P.seq(P.string("\\"), nameParser, P.seq(...parametersParsers))
            .thru(this.contextualiseParserOutput(
                this.reparsers.anyCommand, // TODO: fix
                (value, context, reparser) => new CommandNode(
                    value[1],
                    value[2],
                    context,
                    reparser
                )
            ));
    }

    private createEnvironementParser(environement: EnvironementSpecification): P.Parser<EnvironmentNode> {
        const nameParser = (environement.nameParser ?? P.string(environement.name))
            .thru(this.contextualiseParserOutput(
                this.reparsers.parameter, // TODO: fix
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
            .thru(this.contextualiseParserOutput(this.reparsers.anyEnvironement, (value, context, reparser) => {
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
                    .thru(this.contextualiseParserOutput(this.reparsers.text, (value, context, reparser) => new TextNode(value, context, reparser)));
            },
        
            whitespace: lang => {
                return P.alt(P.whitespace, P.newline)
                    .thru(this.contextualiseParserOutput(this.reparsers.whitespace, (value, context, reparser) => new WhitespaceNode(context, reparser)));
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
                return P.regexp(/\\(([^a-z])|(([a-z]+\**)))/i)
                    .thru(this.contextualiseParserOutput(this.reparsers.anyCommand, (value, context, reparser) => new CommandNode(
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
                        this.reparsers.math,
                        (value, context, reparser) => new MathNode(value.join(""), context, reparser)
                    ));
            },
        
            inlineMath: lang => {
                return P.seq(singleDollar, lang.math, singleDollar)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.inlineMath,
                        (value, context, reparser) => new InlineMathNode(value[1], context, reparser)
                    )); 
            },
        
            displayMath: lang => {
                return P.seq(doubleDollar, lang.math, doubleDollar)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.displayMath,
                        (value, context, reparser) => new DisplayMathNode(value[1], context, reparser)
                    )); 
            },
        
            block: lang => {
                // TODO: attempt to remove the cast
                const emptyStringParser = P.string("")
                    .map(_ => EMPTY_AST_VALUE) as P.Parser<EmptyASTValue>;
        
                return wrapInCurlyBracesBlockParser(lang.latex.or(emptyStringParser))
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.block,
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
                        this.reparsers.curlyBracesParameterBlock,
                        (value, context, reparser) => new CurlyBracesParameterBlockNode(value[1], context, reparser)
                    ));
            },
        
            parameter: lang => {
                // TODO: use a more robust approach
                return P.regexp(/[^%}]*/)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.parameter,
                        (value, context, reparser) => new ParameterNode(value, context, reparser)
                    ));
            },
        
            optionalParameter: lang => {
                // TODO: use a more robust approach
                return P.regexp(/[^%\]]*/)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.optionalParameter,
                        (value, context, reparser) => new ParameterNode(value, context, reparser)
                    ));
            },
        
            // environementNameParameter: lang => {
            //     return alphastar;
            // },
        
            squareBracesParameterBlock: lang => {
                return wrapInSquareBracesBlockParser(lang.parameterList)
                .thru(this.contextualiseParserOutput(
                    this.reparsers.squareBracesParameterBlock,
                    (value, context, reparser) => new SquareBracesParameterBlockNode(value[1], context, reparser)
                ));
            },
        
            parameterKey: lang => {
                return alphanum
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.parameterKey,
                        (value, context, reparser) => new ParameterKeyNode(value, context, reparser)
                    ));
            },
        
            parameterValue: lang => {
                // TODO: use a more robust approach
                return P.regexp(/[^,\]]+/m)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.parameterValue,
                        (value, context, reparser) => new ParameterValueNode(value, context, reparser)
                    ));
            },
        
            parameterAssignment: lang => {
                return P.seq(lang.parameterKey, equal.trim(P.optWhitespace), lang.parameterValue)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.parameterAssignment,
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
                        this.reparsers.parameterList,
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
                        this.reparsers.specialSymbol,
                        (value, context, reparser) => new SpecialSymbolNode(value, context, reparser)
                    ));
            },
        
            comment: lang => {
                return P.regexp(/%.*/)
                    .thru(this.contextualiseParserOutput(
                        this.reparsers.comment,
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
                        this.reparsers.latex,
                        (value, context, reparser) => new LatexNode(value, context, reparser)
                    ));
            }
        });
    }

    private createReparsers(): LatexReparsers {
        const createParserWithPaddedInput = <T>(parser: P.Parser<T>, input: string, context: ASTNodeContext) => {
            // Left-pad the given input with a special string
            // meant to make the actual parser start at the same position
            // than the start position of the given node's context
            // (so that calls to P.Index return correct positions!)
            const newlinesToSimulate = "\n".repeat(context.range.from.line);
            const lastLineToSimulate = " ".repeat(context.range.from.column);
            const otherCharactersToSimulate = " ".repeat(
                context.range.from.offset // all the characters...
                - context.range.from.line // ...minus the newlines
                - context.range.from.column // ...minus those of the last line
            );

            const leftPaddedInput = [
                otherCharactersToSimulate,
                newlinesToSimulate,
                lastLineToSimulate,
                input
            ].join("");

            const leftPaddingSkipper = () => Parsimmon((paddedInput, index) => {
                return Parsimmon.makeSuccess(context.range.from.offset, null);
            });

            return {
                parserForPaddedInput: P.seqMap(leftPaddingSkipper(), parser, (_, result) => result),
                paddedInput: leftPaddedInput
            };
        };

        const createASTNodeReparserFor = <T>(parser: P.Parser<T>) =>
            (input: string, context: ASTNodeContext) => {
                const { parserForPaddedInput, paddedInput } = createParserWithPaddedInput(parser, input, context);
                return parserForPaddedInput.parse(paddedInput);
        };

        return {
            latex: createASTNodeReparserFor(this.parsers.latex),
            text: createASTNodeReparserFor(this.parsers.text),
            whitespace: createASTNodeReparserFor(this.parsers.whitespace),
            specificEnvironement: createASTNodeReparserFor(this.parsers.specificEnvironement),
            anyEnvironement: createASTNodeReparserFor(this.parsers.anyEnvironement),
            specificCommand: createASTNodeReparserFor(this.parsers.specificCommand),
            anyCommand: createASTNodeReparserFor(this.parsers.anyCommand),
            commandOrEnvironment: createASTNodeReparserFor(this.parsers.commandOrEnvironment),
            math: createASTNodeReparserFor(this.parsers.math),
            inlineMath: createASTNodeReparserFor(this.parsers.inlineMath),
            displayMath: createASTNodeReparserFor(this.parsers.displayMath),
            block: createASTNodeReparserFor(this.parsers.block),
            curlyBracesParameterBlock: createASTNodeReparserFor(this.parsers.curlyBracesParameterBlock),
            parameter: createASTNodeReparserFor(this.parsers.parameter),
            optionalParameter: createASTNodeReparserFor(this.parsers.optionalParameter),
            squareBracesParameterBlock: createASTNodeReparserFor(this.parsers.squareBracesParameterBlock),
            parameterKey: createASTNodeReparserFor(this.parsers.parameterKey),
            parameterValue: createASTNodeReparserFor(this.parsers.parameterValue),
            parameterAssignment: createASTNodeReparserFor(this.parsers.parameterAssignment),
            parameterList: createASTNodeReparserFor(this.parsers.parameterList),
            specialSymbol: createASTNodeReparserFor(this.parsers.specialSymbol),
            comment: createASTNodeReparserFor(this.parsers.comment)
        };
    }

    async parse(): Promise<P.Result<LatexNode>> {
        const input = await this.sourceFile.getContent();
        return this.parsers.latex.parse(input);
    }
}