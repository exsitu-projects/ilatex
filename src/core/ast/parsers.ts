import * as P from "parsimmon";
import { PositionInFile } from "../utils/PositionInFile";
import { RangeInFile } from "../utils/RangeInFile";
import { ASTNode } from "./nodes/ASTNode";
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


function createParserTransformerWithRange<ParserValue, TransformedOutput>(
    transformer: (value: ParserValue, range: RangeInFile) => TransformedOutput
) {
    return function(parser: P.Parser<ParserValue>) {
        return P.seqMap(P.index, parser, P.index, (start, value, end) => {
            return transformer(
                value,
                new RangeInFile(
                    PositionInFile.fromParsimmonIndex(start),
                    PositionInFile.fromParsimmonIndex(end),
                )
            );
        });
    };

}


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

// Unique symbol representing an empty AST node value
export const EMPTY_AST_VALUE: unique symbol = Symbol("Empty AST value");
export type EmptyASTValue = typeof EMPTY_AST_VALUE;

// Builders for parsers of common types of blocks
function wrapInCurlyBracesBlockParser<T>(parser: P.Parser<T>): P.Parser<[string, T, string]> {
    return P.seq(openCurlyBracket, parser, closeCurlyBracket);
}

function wrapInSquareBracesBlockParser<T>(parser: P.Parser<T>): P.Parser<[string, T, string]> {
    return P.seq(openSquareBracket, parser, closeSquareBracket);
}

// Builder for parsers of command parameters,
// using a dedicated interface to specify them
interface ParameterSpecification {
    type: "curly" | "square";
    parser: P.Parser<ParameterNode | ParameterListNode>;
    optional?: boolean;
}

function createParameterParsers(
    parameters: ParameterSpecification[]
): P.Parser<(CurlyBracesParameterBlockNode | SquareBracesParameterBlockNode | EmptyASTValue)>[] {
    const f = (optionalASTNodeAsArray: CurlyBracesParameterBlockNode[] | SquareBracesParameterBlockNode[]) =>
        optionalASTNodeAsArray.length === 1
            ? optionalASTNodeAsArray[1]
            : EMPTY_AST_VALUE;
    

    const parametersParsers = [];
    for (let parameter of parameters) {
        const parameterParser = (parameter.type === "curly")
            ? wrapInCurlyBracesBlockParser(parameter.parser)
                .thru(createParserTransformerWithRange((value, range) => new CurlyBracesParameterBlockNode(value[1], range)))
            : wrapInSquareBracesBlockParser(parameter.parser)
                .thru(createParserTransformerWithRange((value, range) => new SquareBracesParameterBlockNode(value[1], range)));
        
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

// Builder for parsers of commands
// (which can include 0+ mandatory and/or optional parameters)
interface CommandSpecification {
    name: string;
    nameParser?: P.Parser<string>; // use P.string(name) if absent
    parameters: ParameterSpecification[];
}

function createCommandParser(command: CommandSpecification): P.Parser<CommandNode> {
    const nameParser = command.nameParser ?? P.string(command.name);
    // const nameParserWithPositions = P.seq(P.index, nameParser, P.index);

    // Create an array of parsers for all the parameters
    const parametersParsers = createParameterParsers(command.parameters);

    // Return a parser which expects the command followed by all its parameters
    // (though optional ones may of course be absent)
    return P.seq(P.string("\\"), nameParser, ...parametersParsers)
        .thru(createParserTransformerWithRange((value, range) => new CommandNode(value[1], value[2], range)));
}

// Builder for parsers of environements
interface EnvironementSpecification {
    name: string;
    nameParser?: P.Parser<string>;  // use P.string(name) if absent
    parameters: ParameterSpecification[];
    contentParser: P.Parser<ASTNode>;
}

function createEnvironementParser(environement: EnvironementSpecification): P.Parser<EnvironmentNode> {
    const nameParser = (environement.nameParser ?? P.string(environement.name))
        .thru(createParserTransformerWithRange((value, range) => new ParameterNode(value, range)));
    
    // Create parsers for \begin and \end commands
    const beginParser = createCommandParser({
        name: "begin",
        parameters: [{
            type: "curly",
            parser: nameParser
        }]
    });

    const endParser = createCommandParser({
        name: "end",
        parameters: [{
            type: "curly",
            parser: nameParser
        }]
    });

    // Create parsers for the environement parameters
    const parametersParsers = createParameterParsers(environement.parameters);

    // Return a parser which expects the begin command, followed by all the env. parameters,
    // followed by the content of the environement, followed by the end command
    //const seq = P.seq as (...parsers: P.Parser<ASTNode>[]) => P.Parser<ASTNode[]>;
    return P.seq(
        beginParser,
        P.seq(...parametersParsers),
        environement.contentParser,
        endParser
    )
        .thru(createParserTransformerWithRange((value, range) => {
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
                range
            );
        }));
}

// Language of a simplified subset of LaTeX
// It can be parsed by using the 'latex' rule as the axiom of the grammar
const language = P.createLanguage<{
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
    // environementNameParameter: ParameterNode,
    squareBracesParameterBlock: SquareBracesParameterBlockNode,
    parameterKey: ParameterKeyNode,
    parameterValue: ParameterValueNode,
    parameterAssignment: ParameterAssignmentNode,
    parameterList: ParameterListNode,
    specialSymbol: SpecialSymbolNode,
    comment: CommentNode,
}>({
    text: lang => {
        return regularSentences
            .thru(createParserTransformerWithRange((value, range) => new TextNode(value, range)));
    },

    whitespace: lang => {
        return P.whitespace
            .thru(createParserTransformerWithRange((value, range) => new WhitespaceNode(range)));
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
            ...specifiedEnvironements.map(environement => createEnvironementParser(environement))
        );
    },

    anyEnvironement: lang => {
        return createEnvironementParser({
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
            ...specifiedCommands.map(command => createCommandParser(command))
        );
    },

    anyCommand: lang => {
        return P.regexp(/\\(([^a-z])|(([a-z]+\*?)))/i)
            .thru(createParserTransformerWithRange((value, range) => new CommandNode(
                value.substr(1), // Ignore the the leading backslash
                [], // An unspecified command always has no parameter
                range
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
            .thru(createParserTransformerWithRange((value, range) => new MathNode(value.join(""), range)));
    },

    inlineMath: lang => {
        return P.seq(singleDollar, lang.math, singleDollar)
            .thru(createParserTransformerWithRange((value, range) => new InlineMathNode(value[1], range))); 
    },

    displayMath: lang => {
        return P.seq(doubleDollar, lang.math, doubleDollar)
            .thru(createParserTransformerWithRange((value, range) => new DisplayMathNode(value[1], range))); 
    },

    block: lang => {
        // TODO: attempt to remove the cast
        const emptyStringParser = P.string("")
            .map(_ => EMPTY_AST_VALUE) as P.Parser<EmptyASTValue>;

        return wrapInCurlyBracesBlockParser(lang.latex.or(emptyStringParser))
            .thru(createParserTransformerWithRange((value, range) => new BlockNode(
                value[1] === EMPTY_AST_VALUE ? [] : value[1].content,
                range
            )));
    },

    curlyBracesParameterBlock: lang => {
        return wrapInCurlyBracesBlockParser(lang.parameter)
            .thru(createParserTransformerWithRange((value, range) => new CurlyBracesParameterBlockNode(value[1], range)));
    },

    parameter: lang => {
        // TODO: use a more robust approach
        return P.regexp(/[^%}]*/)
            .thru(createParserTransformerWithRange((value, range) => new ParameterNode(value, range)));
    },

    optionalParameter: lang => {
        // TODO: use a more robust approach
        return P.regexp(/[^%\]]*/)
            .thru(createParserTransformerWithRange((value, range) => new ParameterNode(value, range)));
    },

    // environementNameParameter: lang => {
    //     return alphastar;
    // },

    squareBracesParameterBlock: lang => {
        return wrapInSquareBracesBlockParser(lang.parameterList)
        .thru(createParserTransformerWithRange((value, range) => new SquareBracesParameterBlockNode(value[1], range)));
    },

    parameterKey: lang => {
        return alphanum
            .thru(createParserTransformerWithRange((value, range) => new ParameterKeyNode(value, range)));
    },

    parameterValue: lang => {
        // TODO: use a more robust approach
        return P.regexp(/[^,\]]+/m)
            .thru(createParserTransformerWithRange((value, range) => new ParameterValueNode(value, range)));
    },

    parameterAssignment: lang => {
        return P.seq(lang.parameterKey, equal.trim(P.optWhitespace), lang.parameterValue)
            .thru(createParserTransformerWithRange((value, range) => new ParameterAssignmentNode(
                value[0],
                value[2],
                range
            )));
    },

    parameterList: lang => {
        return (P.alt(
            lang.parameterAssignment,
            lang.parameterValue,
        ) as P.Parser<ParameterAssignmentNode | ParameterValueNode>)
            .sepBy(comma.trim(P.optWhitespace))
            .thru(createParserTransformerWithRange((value, range) => new ParameterListNode(value, range)));
    },

    specialSymbol: lang => {
        return P.alt(
            P.string("&"),
            P.string("_"),
            P.string("#")
        )
            .thru(createParserTransformerWithRange((value, range) => new SpecialSymbolNode(value, range)));
    },

    comment: lang => {
        return P.regexp(/%.*/)
            .thru(createParserTransformerWithRange((value, range) => new CommentNode(value, range)));
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
            .thru(createParserTransformerWithRange((value, range) => new LatexNode(value, range)));
    }
});

export { language };