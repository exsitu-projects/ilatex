import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

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

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterValueNode(this, depth);
    }
}