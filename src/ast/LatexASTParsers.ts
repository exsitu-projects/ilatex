import * as P from "parsimmon";
import { ASTNodeType, ASTNode } from "./LatexASTNode";

/**
 * Create an AST node wrapper, which creates a wrapper function when called.
 * 
 * A wrapper function takes a parser as input and returns a parser
 * which yields an AST node as output (using the given type and name, if any).
 */
export function createParserOutputASTAdapter<V>(type: ASTNodeType, name: string = "") {
    return function(parser: P.Parser<V>) {
        return P.seqMap(P.index, parser, P.index, (start, value, end) => {
            return Object.freeze({
                name: name,
                type: type,
                value: value,
                start: start,
                end: end
            } as ASTNode<V>);
        });
    };
}

/** Parser for a simplified subset of LaTeX. */
// Defined here (because it has to be referenced) but actually defined later
let latex: P.Parser<any> = P.lazy(() => P.any);

// General parsers
const alphanum = P.regexp(/^[a-z0-9]+/i);
const regularCharacters = P.regexp(/[^\\\$&_%{}#]+/);

// Regular text
const text = regularCharacters
    .thru(createParserOutputASTAdapter(ASTNodeType.Text));

// Comments
const comment = P.regexp(/%.*/)
    .thru(createParserOutputASTAdapter(ASTNodeType.Comment)); 

// Special symbols
const backslash = P.string("\\");
const singleBackslash = backslash.notFollowedBy(backslash);
const doubleBackslash = P.string("\\\\")
    .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "double-backslash"));

const ampersand = P.string("&")
    .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "ampersand")); 
const underscore = P.string("_")
    .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "underscore"));
const sharp = P.string("#")
    .thru(createParserOutputASTAdapter(ASTNodeType.SpecialSymbol, "sharp")); 

const specialSymbols = P.alt(
    doubleBackslash,
    ampersand,
    underscore,
    sharp
);

// Maths
const dollar = P.string("$");
const singleDollar = dollar.notFollowedBy(dollar);
const doubleDollar = P.string("$$");

const mathContent = P.alt(
    comment,
    P.regexp(/[^\$%]*/)
);

const inlineMathBlock = P.seqMap(singleDollar, mathContent, singleDollar, ($1, c, $2) => c)
    .thru(createParserOutputASTAdapter(ASTNodeType.InlineMathBlock)); 
const mathBlock = P.seqMap(doubleDollar, mathContent, doubleDollar, ($$1, c, $$2) => c)
    .thru(createParserOutputASTAdapter(ASTNodeType.MathBlock)); 

// Curly/square braces blocks
const equal = P.string("=");
const comma = P.string(",");
const openCurlyBracket = P.string("{");
const closeCurlyBracket = P.string("}");
const openSquareBracket = P.string("[");
const closeSquareBracket = P.string("]");

const anyCommand = P.seq(singleBackslash, P.regexp(/\\([^\\])|(([a-z]+\*?))/i))
    .thru(createParserOutputASTAdapter(ASTNodeType.Command)); 

function curlyBracesBlock<T>(content: P.Parser<T>) {
    return P.seqMap(openCurlyBracket, content, closeCurlyBracket, (b1, c, b2) => c)
        .thru(createParserOutputASTAdapter(ASTNodeType.CurlyBracesBlock));
}

function squareBracesBlock<T>(content: P.Parser<T>) {
    return P.seqMap(openSquareBracket, content, closeSquareBracket, (b1, c, b2) => c)
        .thru(createParserOutputASTAdapter(ASTNodeType.SquareBracesBlock));
}

// Command parameters
const parameterKey = alphanum
    .thru(createParserOutputASTAdapter(ASTNodeType.ParameterKey));
const parameterValue: P.Parser<any> = P.lazy(
    () => P.alt(
        anyCommand,
        inlineMathBlock,
        curlyBracesBlock(latex),
        //squareBracesBlock(parameterAssignments),
        P.regexp(/[^\\\$&_%{}#\]\[,]+/)
    ).many())
    .thru(createParserOutputASTAdapter(ASTNodeType.ParameterValue));

const parameterAssignment = P.seqMap(parameterKey, P.optWhitespace, equal, P.optWhitespace, parameterValue,
    (key, sp1, eq, sp2, value) => {
        return {key: key, value: value};
    })
    .thru(createParserOutputASTAdapter(ASTNodeType.ParameterAssigment));
const parameterAssignments = parameterAssignment.sepBy(comma.trim(P.optWhitespace));

interface CommandParameter {
    type: "curly" | "square";
    parser: P.Parser<any>;
    optional?: boolean;
}

function ensureArray(parameters?: CommandParameter | CommandParameter[]): CommandParameter[] {
    if (parameters === undefined) {
        return [];
    }

    return (Array.isArray(parameters)
         ? parameters
         : [parameters]) as CommandParameter[];
}

// Commands
function command(name: string, parameters?: CommandParameter | CommandParameter[]): P.Parser<any> {
    let parser = P.seq(singleBackslash, P.string(name)).tie();

    // Append the parser of each parameter after the current parser value
    const parametersParsers = [];
    const listOfParameters = ensureArray(parameters);

    for (let parameter of listOfParameters) {
        const parameterParser = (parameter.type === "curly")
                              ? curlyBracesBlock(parameter.parser)
                              : squareBracesBlock(parameter.parser);
        
        // If the argument is optional, the parser can be applied zero or one time
        // Otherwise, it must appear exactly one time
        const minNbTimes = parameter.optional ? 0 : 1;
        parametersParsers.push(
            parameterParser
                .times(minNbTimes, 1)
        );
    }

    return P.seq(parser, ...parametersParsers)
        .map(([name, ...parameters]: [string, Array<Array<{}>>]) => {
            const flattenedParameters = [];
            for (let parameter of parameters) {
                if (parameter.length === 1) {
                    flattenedParameters.push(parameter[0]);
                }
            }

            return {
                name: name,
                parameters: flattenedParameters
            };
        })
        .thru(createParserOutputASTAdapter(ASTNodeType.Command, name));
}

// Environements
function environnement(name: string,  parameters?: CommandParameter | CommandParameter[]) {
    const environnementNameParameter: CommandParameter = {
        type: "curly",
        optional: false,
        parser: P.string(name).trim(P.optWhitespace)
    };

    return P.seqMap(
        command("begin", [environnementNameParameter, ...ensureArray(parameters)]),
        latex,
        command("end", environnementNameParameter),
        (begin, content, end) => {
            return {
                begin: begin,
                content: content,
                end: end    
            };
        }
    ).thru(createParserOutputASTAdapter(ASTNodeType.Environement, name));
}

// Commands and environements of interest

// \includegraphics[assignments*]{path}
const includegraphics = command("includegraphics", [
    {type: "square", parser: parameterAssignments, optional: true},
    {type: "curly", parser: parameterValue}
]);

// \begin{tabular}{columns} ... \end{tabular}
const tabular = environnement("tabular",
    {type: "curly", parser: parameterValue}
);

// Actually define and export the 'latex' parser
latex = P.lazy(() => P.alt(
        // Comments
        comment,

        // Commands and environements of interest
        includegraphics,
        tabular,

        // Special blocks
        inlineMathBlock,
        mathBlock,
        curlyBracesBlock(latex),

        // Special symbols
        singleBackslash,
        specialSymbols,

        // Text (and whitespaces)
        text
    ).many()
).thru(createParserOutputASTAdapter(ASTNodeType.Latex));

export { latex };