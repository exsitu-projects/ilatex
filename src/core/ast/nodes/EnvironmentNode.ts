import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { CommandNode } from "./CommandNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../LatexParser";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";

type NonEmptyEnvironementsNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
)[];


export type EnvironmentNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
    | EmptyASTValue
)[];


export class EnvironmentNode extends ASTNode {
    static readonly type = "environment" as const;

    readonly type = EnvironmentNode.type;
    readonly name: string;
    readonly beginCommand: CommandNode;
    readonly parameters: EnvironmentNodeParameters;
    readonly body: ASTNode;
    readonly endCommand: CommandNode;
    protected parser: ASTNodeParser<EnvironmentNode>;
    protected readonly isLeaf = false;

    constructor(
        name: string,
        beginCommand: CommandNode,
        parameters: EnvironmentNodeParameters,
        body: ASTNode,
        endCommand: CommandNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<EnvironmentNode>
    ) {
        super(context);
        
        this.name = name;
        this.beginCommand = beginCommand;
        this.parameters = parameters;
        this.body = body;
        this.endCommand = endCommand;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        const nonEmptyParameters = this.parameters
            .filter(parameter => parameter !== EMPTY_AST_VALUE) as NonEmptyEnvironementsNodeParameters;
        
        return [
            this.beginCommand,
            ...nonEmptyParameters,
            this.body,
            this.endCommand
        ];
    }
    
    toString(): string {
        return `Environment [${this.name}]`;
    }

    protected async updateWith(reparsedNode: EnvironmentNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.name = reparsedNode.name;
        writeableSelf.beginCommand = reparsedNode.beginCommand;
        writeableSelf.parameters = reparsedNode.parameters;
        writeableSelf.body = reparsedNode.body;
        writeableSelf.endCommand = reparsedNode.endCommand;
    }

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitEnvironmentNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitEnvironmentNode(this, depth);
    }
}