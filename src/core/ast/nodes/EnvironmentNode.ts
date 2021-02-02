import * as P from "parsimmon";
import { ASTNode, ASTNodeParser } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { latexParsers } from "../parsers";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { CommandNode } from "./CommandNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../parsers";


export type EnvironmentNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
    | EmptyASTValue
)[];


export class EnvironmentNode extends ASTNode {
    static readonly type = "environment" as const;
    static readonly parser = latexParsers.commandOrEnvironment as ASTNodeParser<EnvironmentNode>;

    readonly type = EnvironmentNode.type;
    readonly parser = EnvironmentNode.parser;

    readonly name: string;
    readonly beginCommand: CommandNode;
    readonly parameters: EnvironmentNodeParameters;
    readonly body: ASTNode;
    readonly endCommand: CommandNode;

    constructor(
        name: string,
        beginCommand: CommandNode,
        parameters: EnvironmentNodeParameters,
        body: ASTNode,
        endCommand: CommandNode,
        range: RangeInFile
    ) {
        super(range);
        
        this.name = name;
        this.beginCommand = beginCommand;
        this.parameters = parameters;
        this.body = body;
        this.endCommand = endCommand;
    }
    
    toString(): string {
        return `Environment [${this.name}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitEnvironmentNode(this, depth);

        this.beginCommand.visitWith(visitor, depth + 1, maxDepth);
        for (let parameterNode of this.parameters) {
            if (parameterNode === EMPTY_AST_VALUE) {
                continue;
            }

            parameterNode.visitWith(visitor, depth + 1, maxDepth);
        }
        this.body.visitWith(visitor, depth + 1, maxDepth);
        this.endCommand.visitWith(visitor, depth + 1, maxDepth);
    };
}