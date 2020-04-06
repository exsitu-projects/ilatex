import * as P from "parsimmon";
import { ASTNodeType, ASTNode, ASTNodeValue, ASTParameterValueNode, ASTLatexNode, ASTTextNode, ASTEnvironementNode, ASTCommandNode, ASTInlineMathBlockNode, ASTMathBlockNode, ASTBlockNode, ASTParameterNode, ASTParameterKeyNode, ASTParameterAssignmentNode, ASTSpecialSymbolNode, ASTCommentNode, ASTMathNode, ASTCurlyBracesParameterBlock, ASTSquareBracesParameterBlock, ASTParameterListNode, ASTWhitespaceNode } from "./LatexASTNode";

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
>(type: T, name: string = "", startPos?: P.Index) {
    return function(parser: P.Parser<V>) {
        return P.seqMap(P.index, parser, P.index, (start, value, end) => {
            return new ASTNode<T, V>(
                name,
                type,
                value,
                (startPos ?? start),
                end
            );
        });
    };
}


// General sets of characters
const alphanum = P.regexp(/[a-z0-9]+/i);
const alphastar = P.regexp(/[a-z]+\*?/i);

// Words written with regular characters and spaced by at most one whitespace char (\s)
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
interface CommandParameter {
    type: "curly" | "square";
    parser: P.Parser<ASTParameterNode | ASTParameterListNode>;
    optional?: boolean;
}

function createParameterParsers(parameters: CommandParameter[]): P.Parser<(ASTParameterNode | ASTParameterListNode)[]>[] {
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
function createCommandParser(name: string, nameParser: P.Parser<string>, parameters: CommandParameter[] = []): P.Parser<ASTCommandNode> {
    // Create an array of parsers for all the parameters
    const parametersParsers = createParameterParsers(parameters);

    // Return a parser which expects the command followed by all its parameters
    // (though optional ones may of course be absent)
    return P.seq(nameParser, ...parametersParsers)
        .map(([name, ...parameters]: [string, any]) => {
            return {
                name: name as string,
                parameters: parameters as (ASTParameterNode[] | ASTParameterListNode[])[]
            };
        })
        .thru(createParserOutputASTAdapter(ASTNodeType.Command, name));
}

// Interface of the description of a specific environement
interface EnvironementSpecification {
    parser: P.Parser<ASTNode>;
    parameters: CommandParameter[];
}

// Language of a simplified subset of LaTeX
// It can be parsed by using the 'latex' rule as the axiom of the grammar
const language = P.createLanguage<{
    latex: ASTLatexNode,
    text: ASTTextNode,
    whitespace: ASTWhitespaceNode,
    environement: ASTEnvironementNode,
    command: ASTCommandNode,
    anyCommand: ASTCommandNode,
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

    environement: lang => {
        const beginParser = createCommandParser("begin", P.string("\\begin"), [{
            type: "curly",
            parser: lang.environementNameParameter
        }]);

        // Spec. of the environements of interest
        const specifiedEnvironements: Record<string, EnvironementSpecification> = {
            "tabular": {
                parser: lang.latex,
                parameters: [{
                    type: "curly",
                    parser: lang.parameter,
                }]
            },

            "itemize": {
                parser: lang.latex,
                parameters: []
            }
        };

        return beginParser
            .chain(beginNode => {
                const environementNameParameterNode = beginNode.value.parameters[0] as ASTParameterNode[];
                const environementName = environementNameParameterNode[0].value;

                const endParser = createCommandParser("end", P.string("\\end"), [{
                    type: "curly",
                    parser: P.string(environementName)
                        .thru(createParserOutputASTAdapter(ASTNodeType.Parameter))
                }]);

                if (environementName in specifiedEnvironements) {
                    const specification = specifiedEnvironements[environementName];
                    
                    const seqMap = P.seqMap as (...args: any) => any;
                    return seqMap(
                        ...createParameterParsers(specification.parameters),
                        specification.parser,
                        endParser,

                        (...nodes: any) => {
                            const end = nodes.pop();
                            const content = nodes.pop();
                            const parameters = nodes;

                            return {
                                begin: beginNode,
                                parameters: parameters,
                                content: content,
                                end: end
                            };
                        }
                    )
                        .thru(createParserOutputASTAdapter(ASTNodeType.Environement, environementName, beginNode.start));
                }
                else {
                    return P.seqMap(
                        lang.latex,
                        endParser,
                        (content, end) => {
                            return {
                                begin: beginNode,
                                parameters: [],
                                content: content,
                                end: end
                            };
                        }
                    )
                        .thru(createParserOutputASTAdapter(ASTNodeType.Environement, environementName, beginNode.start));
                }
            });
    },

    // Commands of interest
    command: lang => {
        // \includegraphics[assignments*]{path}
        const specifiedCommands = [
            createCommandParser("includegraphics", P.string("\\includegraphics"), [
                {type: "square", parser: lang.parameterList, optional: true},
                {type: "curly", parser: lang.parameter}
            ]),

            createCommandParser("\\\\", P.string("\\\\"), [
                {type: "square", parser: lang.optionalParameter, optional: true}
            ]),
        ];

        return P.alt(...specifiedCommands);
            //.or(lang.anyCommand);
    },

    anyCommand: lang => {
        return P.regexp(/\\(([^a-z])|(([a-z]+\*?)))/i)
            .map(commandName => {
                return {name: commandName, parameters: []};
            })
            .thru(createParserOutputASTAdapter(ASTNodeType.Command));
    },

    math: lang => {
        return P.alt(
            //lang.comment.map(c => c.value),
            P.regexp(/[^\$%]*/)
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
        return createCurlyBracesBlockParser(lang.latex)
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
                .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "ampersand")),
            P.string("_")
                .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "underscore")),
            P.string("#")
                .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "sharp"))
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

            // Environements and commands
            lang.environement,
            lang.command,
            //lang.anyCommand,

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