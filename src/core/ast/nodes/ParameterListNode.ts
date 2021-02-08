import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ParameterValueNode } from "./ParameterValueNode";
import { ParameterAssignmentNode } from "./ParameterAssignmentNode";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";

export class ParameterListNode extends ASTNode {
    static readonly type = "parameter-list" as const;

    readonly type = ParameterListNode.type;
    readonly parameters: (ParameterValueNode | ParameterAssignmentNode)[];
    protected parser: ASTNodeParser<ParameterListNode>;

    constructor(
        parameters: (ParameterValueNode | ParameterAssignmentNode)[],
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterListNode>
    ) {
        super(context);

        this.parameters = parameters;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [...this.parameters];
    }
    
    toString(): string {
        return `Parameter list`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        const indexOfCurrentChildNode = this.parameters.indexOf(currentChildNode as any);
        if (indexOfCurrentChildNode >= 0) {
            this.stopObservingChildNode(currentChildNode);
            this.parameters.splice(indexOfCurrentChildNode, 1, newChildNode as any);
            this.startObservingChildNode(newChildNode);
        }
        else {
            console.error(`AST node replacement failed (in node ${this.toString()}): the current child node was not found.`);
        }
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterListNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterListNode(this, depth);
    }
}