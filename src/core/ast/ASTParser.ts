import * as P from "parsimmon";
import { SourceFile } from "../source-files/SourceFile";
import { LatexParser } from "./LatexParser";


/** An error thrown when an AST parser fails at parsing a source file. */
export class ASTParsingError {
    readonly failure: P.Failure;

    constructor(failure: P.Failure) {
        this.failure = failure;
    }
}


/** A utility class to parse an entire source file into an AST. */
export class ASTParser {
    private readonly sourceFile: SourceFile;
    private readonly contextualisedLatexParser: LatexParser;

    constructor(sourceFile: SourceFile) {
        this.sourceFile = sourceFile;
        this.contextualisedLatexParser = new LatexParser(this.sourceFile);
    }

    /**
     * Parse the source file.
     * 
     * In case of success, return the root node of the parsed AST.
     * In case of failure, throw a [[LatexParsingError]].
     */ 
    async parse() {
        const potentialAstRoot = await this.contextualisedLatexParser.parse();

        if (potentialAstRoot.status === true) {
            return potentialAstRoot.value;
        }
        else {
            throw new ASTParsingError(potentialAstRoot);
        }
    }
}