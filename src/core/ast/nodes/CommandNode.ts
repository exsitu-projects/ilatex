import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../LatexParser";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { SourceFilePosition } from "../../source-files/SourceFilePosition";

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
    protected readonly isLeaf = false;

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

    get nameEnd(): SourceFilePosition {
        return this.range.from.withTranslation({ column: this.name.length + 1 });
    }

    get childNodes(): ASTNode[] {
        return this.parameters
            .filter(parameter => parameter !== EMPTY_AST_VALUE) as NonEmptyCommandNodeParameters;
    }

    toString(): string {
        return `Command [\\${this.name}]`;
    }

    protected async updateWith(reparsedNode: CommandNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.name = reparsedNode.name;
        writeableSelf.parameters = reparsedNode.parameters;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitCommandNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitCommandNode(this, depth);
    }
}