import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class ParameterKeyNode extends ASTNode {
    static readonly type = "parameter-key" as const;

    readonly type = ParameterKeyNode.type;
    readonly name: string;
    protected parser: ASTNodeParser<ParameterKeyNode>;

    constructor(
        name: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterKeyNode>
    ) {
        super(context);
        
        this.name = name;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Parameter key [${this.name}]`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterKeyNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterKeyNode(this, depth);
    }
}