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
    
    toString(): string {
        return `Parameter key [${this.name}]`;
    }

    visitWith(
        visitor: ASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        visitor.visitParameterKeyNode(this, depth);
    }
}