import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../parsers";


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
    readonly name: string;
    readonly parameters: CommandNodeParameters;

    constructor(
        name: string,
        parameters: CommandNodeParameters,
        range: RangeInFile
    ) {
        super(range);

        this.name = name;
        this.parameters = parameters;
    }

    toString(): string {
        return `Command [\\${this.name}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitCommandNode(this, depth);

        for (let parameterNode of this.parameters) {
            if (parameterNode === EMPTY_AST_VALUE) {
                continue;
            }

            parameterNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}