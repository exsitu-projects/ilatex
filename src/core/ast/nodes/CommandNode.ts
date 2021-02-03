import * as P from "parsimmon";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../LatexParser";

type NonEmptyCommandNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
)[];

export type CommandNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
    | EmptyASTValue
)[];


export class CommandNode extends ASTNode {
    static readonly type = "command" as const;

    readonly type = CommandNode.type;
    readonly name: string;
    readonly parameters: CommandNodeParameters;
    protected parser: ASTNodeParser<CommandNode>;

    constructor(
        name: string,
        parameters: CommandNodeParameters,
        context: ASTNodeContext,
        parser: ASTNodeParser<CommandNode>
    ) {
        super(context);

        this.name = name;
        this.parameters = parameters;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return this.parameters
            .filter(parameter => parameter !== EMPTY_AST_VALUE) as NonEmptyCommandNodeParameters;
    }

    toString(): string {
        return `Command [\\${this.name}]`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        const indexOfCurrentChildNode = this.parameters.indexOf(currentChildNode as any);
        if (indexOfCurrentChildNode >= 0) {
            this.stopObservingChildNode(currentChildNode);
            this.parameters.splice(indexOfCurrentChildNode, 1, newChildNode as any);
            this.startObservingChildNode(newChildNode);
        }
        else {
            console.error(`AST node replacement failed (in node ${this.toString()}): the current child node was not found.`);
        }
    };

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