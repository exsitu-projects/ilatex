import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";

export class ParameterValueNode extends ASTNode {
    static readonly type = "parameter-value" as const;

    readonly type = ParameterValueNode.type;
    readonly value: string;
    protected parser: ASTNodeParser<ParameterValueNode>;

    constructor(
        value: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterValueNode>
    ) {
        super(context);

        this.value = value;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [];
    }
    
    toString(): string {
        return `Parameter value [${this.value}]`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        // Since this node does not have any child node, there is nothing to do
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterValueNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterValueNode(this, depth);
    }
}