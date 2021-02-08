import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ParameterNode } from "./ParameterNode";
import { ParameterListNode } from "./ParameterListNode";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";

export class SquareBracesParameterBlockNode extends ASTNode {
    static readonly type = "square-braces-parameter-block" as const;

    readonly type = SquareBracesParameterBlockNode.type;
    readonly content: ParameterNode | ParameterListNode;
    protected parser: ASTNodeParser<SquareBracesParameterBlockNode>;

    constructor(
        content: ParameterNode | ParameterListNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<SquareBracesParameterBlockNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.content];
    }
    
    toString(): string {
        return `[] parameter`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        const writeableThis = this as Writeable<this>;

        if (this.content === currentChildNode as any) {
            this.stopObservingChildNode(currentChildNode);
            writeableThis.content = newChildNode as any;
            this.startObservingChildNode(newChildNode);
        }
        else {
            console.error(`AST node replacement failed (in node ${this.toString()}): the current child node was not found.`);
        }
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitSquareBracesParameterBlockNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitSquareBracesParameterBlockNode(this, depth);
    }
}