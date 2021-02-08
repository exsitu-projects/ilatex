import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ParameterKeyNode } from "./ParameterKeyNode";
import { ParameterValueNode } from "./ParameterValueNode";

export class ParameterAssignmentNode extends ASTNode {
    static readonly type = "parameter-assignment" as const;

    readonly type = ParameterAssignmentNode.type;
    readonly key: ParameterKeyNode;
    readonly value: ParameterValueNode;
    protected parser: ASTNodeParser<ParameterAssignmentNode>;

    constructor(
        key: ParameterKeyNode,
        value: ParameterValueNode,
        context: ASTNodeContext,
        parser: ASTNodeParser<ParameterAssignmentNode>
    ) {
        super(context);

        this.key = key;
        this.value = value;
        this.parser = parser;
    }

    get childNodes(): ASTNode[] {
        return [this.key, this.value];
    }
    
    toString(): string {
        return `Parameter assignment [${this.key.name} = ${this.value.value}]`;
    }

    protected replaceChildNode<T extends ASTNode>(currentChildNode: T, newChildNode: T): void {
        const writeableThis = this as Writeable<this>;

        if (this.key === currentChildNode as any) {
            this.stopObservingChildNode(currentChildNode);
            writeableThis.key = newChildNode as any;
            this.startObservingChildNode(newChildNode);
        }
        else if (this.value === currentChildNode as any) {
            this.stopObservingChildNode(currentChildNode);
            writeableThis.value = newChildNode as any;
            this.startObservingChildNode(newChildNode);
        }
        else {
            console.error(`AST node replacement failed (in node ${this.toString()}): the current child node was not found.`);
        }
    };

    protected syncSelfVisitWith(visitor: ASTSyncVisitor, depth: number = 0): void {
        visitor.visitParameterAssignmentNode(this, depth);
    }

    protected async asyncSelfVisitWith(visitor: ASTAsyncVisitor, depth: number = 0): Promise<void> {
        await visitor.visitParameterAssignmentNode(this, depth);
    }
}