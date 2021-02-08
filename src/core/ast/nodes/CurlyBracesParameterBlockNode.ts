import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ParameterListNode } from "./ParameterListNode";
import { ParameterNode } from "./ParameterNode";

export class CurlyBracesParameterBlockNode extends ASTNode {
    static readonly type = "curly-braces-parameter-block" as const;

    readonly type = CurlyBracesParameterBlockNode.type;
    readonly content: ParameterNode | ParameterListNode;
    protected parser: ASTNodeParser<CurlyBracesParameterBlockNode>;

    constructor(
        content: ParameterNode | ParameterListNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<CurlyBracesParameterBlockNode>
    ) {
        super(context);
        
        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.content];
    }
    
    toString(): string {
        return `{} parameter`;
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
        visitor.visitCurlyBracesParameterBlockNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitCurlyBracesParameterBlockNode(this, depth);
    }
}