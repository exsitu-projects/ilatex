import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";
import { ParameterValueNode } from "./ParameterValueNode";
import { ParameterAssignmentNode } from "./ParameterAssignmentNode";

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
    
    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitParameterListNode(this, depth);

        for (let parameterNode of this.parameters) {
            await parameterNode.visitWith(visitor, depth + 1, maxDepth);
        }
    };
}