import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue } from "../parsers";


export type CommandNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
    | EmptyASTValue
)[];


export class CommandNode extends ASTNode {
    static readonly type = "command" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = CommandNode.type;
    readonly parser = CommandNode.parser;
    readonly parameters: CommandNodeParameters;

    constructor(
        name: string,
        parameters: CommandNodeParameters,
        range: RangeInFile
    ) {
        super(range);
        this.parameters = parameters;
    }

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}