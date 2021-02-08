import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../LatexParser";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";

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

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitCommandNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitCommandNode(this, depth);
    }
}