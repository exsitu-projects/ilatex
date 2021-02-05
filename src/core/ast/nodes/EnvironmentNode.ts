import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { CommandNode } from "./CommandNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../LatexParser";

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

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        const writeableThis = this as Writeable<this>;
        const indexOfCurrentChildNodeInParameters = this.parameters.indexOf(currentChildNode as any);

        if (this.beginCommand === currentChildNode as any) {
            this.stopObservingChildNode(currentChildNode);
            writeableThis.beginCommand = newChildNode as any;
            this.startObservingChildNode(newChildNode);
        }
        else if (indexOfCurrentChildNodeInParameters >= 0) {
            this.stopObservingChildNode(currentChildNode);
            this.parameters.splice(indexOfCurrentChildNodeInParameters, 1, newChildNode as any);
            this.startObservingChildNode(newChildNode);
        }
        else if (this.body === currentChildNode as any) {
            this.stopObservingChildNode(currentChildNode);
            writeableThis.body = newChildNode as any;
            this.startObservingChildNode(newChildNode);
        }
        else if (this.endCommand === currentChildNode as any) {
            this.stopObservingChildNode(currentChildNode);
            writeableThis.endCommand = newChildNode as any;
            this.startObservingChildNode(newChildNode);
        }
        else {
            console.error(`AST node replacement failed (in node ${this.toString()}): the current child node was not found.`);
        }
    };

    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitEnvironmentNode(this, depth);

        await this.beginCommand.visitWith(visitor, depth + 1, maxDepth);
        for (let parameterNode of this.parameters) {
            if (parameterNode === EMPTY_AST_VALUE) {
                continue;
            }

            await parameterNode.visitWith(visitor, depth + 1, maxDepth);
        }
        await this.body.visitWith(visitor, depth + 1, maxDepth);
        await this.endCommand.visitWith(visitor, depth + 1, maxDepth);
    };
}