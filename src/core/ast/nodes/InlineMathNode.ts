import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { MathNode } from "./MathNode";

export class InlineMathNode extends ASTNode {
    static readonly type = "inline-math" as const;

    readonly type = InlineMathNode.type;
    readonly content: MathNode;
    protected parser: ASTNodeParser<InlineMathNode>;

    constructor(
        content: MathNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<InlineMathNode>
    ) {
        super(context);

        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.content];
    }
    
    toString(): string {
        return `Inline math`;
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
    
    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitInlineMathNode(this, depth);

        await this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}