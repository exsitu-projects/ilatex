import * as P from "parsimmon";
import { ASTNodeType, ASTNode, ASTNodeValue, ASTParameterValueNode, ASTLatexNode, ASTTextNode, ASTEnvironementNode, ASTCommandNode, ASTInlineMathBlockNode, ASTMathBlockNode, ASTBlockNode, ASTParameterNode, ASTParameterKeyNode, ASTParameterAssignmentNode, ASTSpecialSymbolNode, ASTCommentNode, ASTMathNode, ASTCurlyBracesParameterBlock, ASTSquareBracesParameterBlock, ASTParameterListNode, ASTWhitespaceNode, ASTEnvironementValue, AST_EMPTY_VALUE, ASTEmptyValue } from "./LatexASTNode";

interface ParserOutputASTAdapterOptions<V extends ASTNodeValue> {
    name?: string | ((value: V) => string);
    startPosition?: P.Index;
}

/**
 * Return a function which creates an adapter function when called.
 * 
 * Each adaptee function takes a parser as input and returns a new parser
 * which yields an AST node which wraps the output of the given parser
 * (using the given type and name/start position, if any).
 */
function createParserOutputASTAdapter<
    T extends ASTNodeType,
    V extends ASTNodeValue
>(type: T, options: ParserOutputASTAdapterOptions<V> = {}) {
    const name = options.name ?? "";
    
    return function(parser: P.Parser<V>) {
        return P.seqMap(P.index, parser, P.index, (start, value, end) => {
            return new ASTNode<T, V>(
                (typeof name === "function" ? name(value) : name),
                type,
                value,
                (options.startPosition ?? start),
                end
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

// Builders for parsers of common types of blocks
function createCurlyBracesBlockParser<V extends ASTNodeValue>(content: P.Parser<V>): P.Parser<V> {
    return P.seqMap(openCurlyBracket, content, closeCurlyBracket, (b1, c, b2) => c);
}

function createSquareBracesBlockParser<V extends ASTNodeValue>(content: P.Parser<V>): P.Parser<V> {
    return P.seqMap(openSquareBracket, content, closeSquareBracket, (b1, c, b2) => c);
}

// Builder for parsers of command parameters,
// using a dedicated interface to specify them
interface ParameterSpecification {
    type: "curly" | "square";
    parser: P.Parser<ASTParameterNode | ASTParameterListNode>;
    optional?: boolean;
}

function createParameterParsers(parameters: ParameterSpecification[]): P.Parser<(ASTParameterNode | ASTParameterListNode)[]>[] {
    const parametersParsers = [];
    for (let parameter of parameters) {
        const parameterParser = (parameter.type === "curly")
                              ? createCurlyBracesBlockParser(parameter.parser)
                              : createSquareBracesBlockParser(parameter.parser);
        
        // If the argument is optional, the parser can be applied zero or one time
        // Otherwise, it must appear exactly one time
        const minNbTimes = parameter.optional ? 0 : 1;
        parametersParsers.push(parameterParser.times(minNbTimes, 1));
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

function createCommandParser(command: CommandSpecification): P.Parser<ASTCommandNode> {
    const nameParser = command.nameParser ?? P.string(command.name);
    const nameParserWithPositions = P.seq(P.index, nameParser, P.index);

    // Create an array of parsers for all the parameters
    const parametersParsers = createParameterParsers(command.parameters);

    // Return a parser which expects the command followed by all its parameters
    // (though optional ones may of course be absent)
    return P.seq(P.string("\\"), nameParserWithPositions, ...parametersParsers)
        .map(([backslash, [nameStart, name, nameEnd], ...parameters]: [string, [P.Index, string, P.Index], any]) => {
            return {
                name: name as string,
                nameStart: nameStart,
                nameEnd: nameEnd,
                parameters: parameters as (ASTParameterNode | ASTParameterListNode)[][]
            };
        })
        .thru(createParserOutputASTAdapter(ASTNodeType.Command, { name: command.name }));
}

// Builder for parsers of environements
interface EnvironementSpecification {
    name: string;
    nameParser?: P.Parser<string>;  // use P.string(name) if absent
    parameters: ParameterSpecification[];
    contentParser: P.Parser<ASTNode>;
}

function createEnvironementParser(environement: EnvironementSpecification): P.Parser<ASTEnvironementNode> {
    const nameParser = environement.nameParser ?? P.string(environement.name);
    
    // Create parsers for \begin and \end commands
    const beginParser = createCommandParser({
        name: "begin",
        parameters: [{
            type: "curly",
            parser: nameParser
                .thru(createParserOutputASTAdapter(ASTNodeType.Parameter))
        }]
    });

    const endParser = createCommandParser({
        name: "end",
        parameters: [{
            type: "curly",
            parser: nameParser
                .thru(createParserOutputASTAdapter(ASTNodeType.Parameter))
        }]
    });

    // Create parsers for the environement parameters
    const parametersParsers = createParameterParsers(environement.parameters);

    // Return a parser which expects the begin command, followed by all the env. parameters,
    // followed by the content of the environement, followed by the end command
    //const seq = P.seq as (...parsers: P.Parser<ASTNode>[]) => P.Parser<ASTNode[]>;
    return P.seqMap(
        beginParser,
        P.seq(...parametersParsers),
        environement.contentParser,
        endParser,

        (beginNode, parameterNodes, contentNode, endNode) => {
                return {
                    begin: beginNode,
                    parameters: parameterNodes,
                    content: contentNode,
                    end: endNode
                };
        })
        .thru(createParserOutputASTAdapter(ASTNodeType.Environement, {
            // If a name parser is specified, use the value it output as the environement name
            // Otherwise, use the given name
            name: (environement.nameParser
                ? (node => (node.begin.value.parameters[0][0] as ASTParameterNode).value)
                : environement.name)
        }));

}

// Language of a simplified subset of LaTeX
// It can be parsed by using the 'latex' rule as the axiom of the grammar
const language = P.createLanguage<{
    latex: ASTLatexNode,
    text: ASTTextNode,
    whitespace: ASTWhitespaceNode,
    specificEnvironement: ASTEnvironementNode,
    anyEnvironement: ASTEnvironementNode,
    specificCommand: ASTCommandNode,
    anyCommand: ASTCommandNode,
    command: ASTCommandNode | ASTEnvironementNode,
    math: ASTMathNode,
    inlineMathBlock: ASTInlineMathBlockNode,
    mathBlock: ASTMathBlockNode,
    block: ASTBlockNode,
    curlyBracesParameterBlock: ASTCurlyBracesParameterBlock,
    parameter: ASTParameterNode,
    optionalParameter: ASTParameterNode,
    environementNameParameter: ASTParameterNode,
    squareBracesParameterBlock: ASTSquareBracesParameterBlock,
    parameterKey: ASTParameterKeyNode,
    parameterValue: ASTParameterValueNode,
    parameterAssignment: ASTParameterAssignmentNode,
    parameterList: ASTParameterListNode,
    specialSymbol: ASTSpecialSymbolNode,
    comment: ASTCommentNode,
}>({
    text: lang => {
        return regularSentences
            .thru(createParserOutputASTAdapter(ASTNodeType.Text));
    },

    whitespace: lang => {
        return P.whitespace
            .thru(createParserOutputASTAdapter(ASTNodeType.Whitespace));
    },
    
    specificEnvironement: lang => {
        // Specifications of the environements of interest
        const specifiedEnvironements: EnvironementSpecification[] = [
            {
                name: "tabular",
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
                name: "includegraphics",
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
        return P.seq(P.index, P.regexp(/\\(([^a-z])|(([a-z]+\*?)))/i), P.index)
            .map(([nameStart, name, nameEnd]: [P.Index, string, P.Index]) => {
                return { 
                    name: name,
                    nameStart: nameStart,
                    nameEnd: nameEnd,
                    parameters: []
                };
            })
            .thru(createParserOutputASTAdapter(ASTNodeType.Command, {
                // Extract the name of the command (without the leading backslash)
                name: node => node.name.substr(1)
            }));
    },

    command: lang => {
        const specificEnvironementNames = ["tabular", "itemize", "gridlayout", "row", "cell"];
        function isStartingWithSpecificEnvironementBeginning(input: string): boolean {
            return specificEnvironementNames.some(name => input.startsWith(`begin{${name}}`));
        }

        const specificCommandNames = ["includegraphics", "\\"];
        function isStartingWithSpecificCommandName(input: string): boolean {
            return specificCommandNames.some(name => input.startsWith(name));
        }

        // Define a custom Parsimmon parser which expects something starting with a backslash,
        // and either return a more-or-less specific command/emvironement parser
        // or fail if what follows the backslash was not expected here.
        // It does not consume any character, as it delegates the parsing to the parser it returns
        function selectCommandParser(): P.Parser<P.Parser<ASTCommandNode> | P.Parser<ASTCommandNode>> {
            const createParserSelector = (input: string, index: number) => {
                if (input.charAt(index) !== "\\") {
                    return P.makeFailure(index, "\\<any command>");
                }

                const remainingInput = input.substring(index + 1);
                // console.log("remaining input",
                //     remainingInput.length > 15 ? remainingInput.substr(0, 12) + "..." : remainingInput);

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
            lang.comment.map(c => c.value),
            P.regexp(/[^$%]+/)
        )
            .atLeast(1)
            .thru(createParserOutputASTAdapter(ASTNodeType.Math));
    },

    inlineMathBlock: lang => {
        return P.seqMap(singleDollar, lang.math, singleDollar, ($1, c, $2) => c)
            .thru(createParserOutputASTAdapter(ASTNodeType.InlineMathBlock)); 
    },

    mathBlock: lang => {
        return P.seqMap(doubleDollar, lang.math, doubleDollar, ($$1, c, $$2) => c)
            .thru(createParserOutputASTAdapter(ASTNodeType.MathBlock)); 
    },

    block: lang => {
        // TODO: attempt to remove the cast
        const emptyStringParser = P.string("")
            .map(_ => AST_EMPTY_VALUE) as P.Parser<ASTEmptyValue>;

        return createCurlyBracesBlockParser(lang.latex.or(emptyStringParser))
            .thru(createParserOutputASTAdapter(ASTNodeType.Block));
    },

    curlyBracesParameterBlock: lang => {
        return createCurlyBracesBlockParser(lang.parameter)
            .thru(createParserOutputASTAdapter(ASTNodeType.CurlyBracesParameterBlock));
    },

    parameter: lang => {
        // TODO: use a more robust approach
        return P.regexp(/[^%}]*/)
            .thru(createParserOutputASTAdapter(ASTNodeType.Parameter));
    },

    optionalParameter: lang => {
        // TODO: use a more robust approach
        return P.regexp(/[^%\]]*/)
            .thru(createParserOutputASTAdapter(ASTNodeType.Parameter));
    },

    environementNameParameter: lang => {
        return alphastar
            .thru(createParserOutputASTAdapter(ASTNodeType.Parameter));
    },

    squareBracesParameterBlock: lang => {
        return createSquareBracesBlockParser(lang.parameterList)
            .thru(createParserOutputASTAdapter(ASTNodeType.SquareBracesParameterBlock));
    },

    parameterKey: lang => {
        return alphanum
            .thru(createParserOutputASTAdapter(ASTNodeType.ParameterKey));
    },

    parameterValue: lang => {
        // TODO: use a more robust approach
        return P.regexp(/[^,\]]+/m)
            .thru(createParserOutputASTAdapter(ASTNodeType.ParameterValue));
    },

    parameterAssignment: lang => {
        return P.seqMap(lang.parameterKey, equal.trim(P.optWhitespace), lang.parameterValue,
            (key, eq, value) => {
                return {
                    key: key,
                    value: value
                };
            })
            .thru(createParserOutputASTAdapter(ASTNodeType.ParameterAssignment));
    },

    parameterList: lang => {
        return P.alt(
            lang.parameterAssignment,
            lang.parameterValue,
        )
            .sepBy(comma.trim(P.optWhitespace))
            .thru(createParserOutputASTAdapter(ASTNodeType.ParameterList));
    },

    specialSymbol: lang => {
        return P.alt(
            P.string("&")
                .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, { name: "ampersand" })),
            P.string("_")
                .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, { name: "underscore" })),
            P.string("#")
                .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, { name: "sharp" }))
        );
    },

    comment: lang => {
        return P.regexp(/%.*/)
            .thru(createParserOutputASTAdapter(ASTNodeType.Comment));
    },

    latex: lang => {
        return P.alt(
            // Comments
            lang.comment,

            // Commands and environements
            lang.command,

            // Special blocks
            lang.mathBlock,
            lang.inlineMathBlock,
            lang.block,

            // Special symbols
            lang.specialSymbol,

            // Text and whitespace
            lang.text,
            lang.whitespace
        )
            .atLeast(1)
            .thru(createParserOutputASTAdapter(ASTNodeType.Latex));
    }
});

export { language };