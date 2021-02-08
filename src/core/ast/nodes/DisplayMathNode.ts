import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { MathNode } from "./MathNode";

export class DisplayMathNode extends ASTNode {
    static readonly type = "display-math" as const;

    readonly type = DisplayMathNode.type;
    readonly content: MathNode;
    protected parser: ASTNodeParser<DisplayMathNode>;

    constructor(
        content: MathNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<DisplayMathNode>
    ) {
        super(context);
        
        this.content = content;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.content];
    }
    
    toString(): string {
        return `Display math`;
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
        visitor.visitDisplayMathNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitDisplayMathNode(this, depth);
    }
}