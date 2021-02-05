import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
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
    
    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitCurlyBracesParameterBlockNode(this, depth);

        await this.content.visitWith(visitor, depth + 1, maxDepth);
    };
}