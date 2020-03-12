import * as P from "parsimmon";

// To be redefined later
let latex: P.Parser<any> = P.lazy(() => P.any);

const alphanum = P.regexp(/^[a-z0-9]+/i);
const regularCharacters = P.regexp(/[^\\\$&_%{}#]+/);

const comment = P.regexp(/%.*/); 

const backslash = P.string("\\");
const singleBackslash = backslash.notFollowedBy(backslash);
const doubleBackslash = P.string("\\\\");

const anyCommand = P.seq(singleBackslash, P.regexp(/\\([^\\])|(([a-z]+\*?))/i));

const dollar = P.string("$");
const singleDollar = dollar.notFollowedBy(dollar);
const doubleDollar = P.string("$$");

const ampersand = P.string("&");
const underscore = P.string("_");
const sharp = P.string("#");
const equal = P.string("=");
const comma = P.string(",");
const openCurlyBracket = P.string("{");
const closeCurlyBracket = P.string("}");
const openSquareBracket = P.string("[");
const closeSquareBracket = P.string("]");

const inlineMathBlock = P.seq(singleDollar, P.regexp(/[^\$%]*/), singleDollar);
const mathBlock = P.seq(doubleDollar, P.regexp(/[^\$%]*/), doubleDollar);

function curlyBracesBlock<T>(content: P.Parser<T>): P.Parser<[string, T, string]> {
    return P.seq(openCurlyBracket, content, closeCurlyBracket);
}

function squareBracesBlock<T>(content: P.Parser<T>): P.Parser<[string, T, string]> {
    return P.seq(openSquareBracket, content, closeSquareBracket);
}

const parameterKey = alphanum;
const parameterValue: P.Parser<any> = P.lazy(() => P.alt(
    anyCommand,
    inlineMathBlock,
    curlyBracesBlock(latex),//parameterValue),
    //squareBracesBlock(parameterAssignments),
    P.regexp(/[^\\\$&_%{}#\]\[,]+/)
).many());

const parameterAssignment = P.seq(parameterKey, P.optWhitespace, equal, P.optWhitespace, parameterValue);
const parameterAssignments = parameterAssignment.sepBy(comma.trim(P.optWhitespace));

interface CommandParameter {
    type: "curly" | "square";
    parser: P.Parser<any>;
    optional?: boolean;
}

function ensureArray(parameters?: CommandParameter | CommandParameter[]): CommandParameter[] {
    return (Array.isArray(parameters)
         ? parameters
         : [parameters]) as CommandParameter[];
}

function command(name: string, parameters?: CommandParameter | CommandParameter[]): P.Parser<any> {
    let parser = P.seq(singleBackslash, P.string(name)); // as P.Parser<any>
    if (parameters === undefined) {
        return parser;
    }

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
        parametersParsers.push(parameterParser.times(minNbTimes, 1));
    }

    return P.seq(parser, ...parametersParsers);
}

function environnement(name: string,  parameters?: CommandParameter | CommandParameter[]): P.Parser<any> {
    const environnementNameParameter: CommandParameter = {
        type: "curly",
        optional: false,
        parser: P.string(name).trim(P.optWhitespace)
    };

    return P.seq(
        command("begin", [environnementNameParameter, ...ensureArray(parameters)]),
        latex,
        command("end", environnementNameParameter)
    );
}

// \includegraphics[assignments*]{path}
const includegraphics = command("includegraphics", [
    {type: "square", parser: parameterAssignments, optional: true},
    {type: "curly", parser: regularCharacters}
]);

// \begin{tabular}{columns} ... \end{tabular}
const tabular = environnement("tabular", {type: "curly", parser: latex});

// Actually define latex parser here
latex = P.lazy(() => P.alt(
        comment,

        // Commands and environements we want to detect
        includegraphics,
        tabular,

        //anyCommand,

        // Special blocks
        inlineMathBlock,
        mathBlock,
        curlyBracesBlock(latex),

        // Special characters
        singleBackslash,
        doubleBackslash,
        ampersand,
        underscore,
        sharp,

        regularCharacters
    ).many()
);

export class LatexParser {
    static parse(data: string) {
        console.log("Parsing...");

        try {
            const result = latex.parse(data);
            console.log(result);
        }
        catch (e) {
            console.log(e);
        }
    }
}