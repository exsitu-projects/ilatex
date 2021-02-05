import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { ASTVisitor } from "../visitors/ASTVisitor";

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

    async visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        await visitor.visitParameterKeyNode(this, depth);
    }
}