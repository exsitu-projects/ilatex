import { ASTNode, ASTNodeContext, ASTNodeParser } from "./ASTNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue, EMPTY_AST_VALUE } from "../LatexParser";
import { ASTSyncVisitor, ASTAsyncVisitor } from "../visitors/visitors";
import { SourceFilePosition } from "../../source-files/SourceFilePosition";
import { CommandNode } from "./CommandNode";


export class VerbCommandNode extends CommandNode {
    readonly type = VerbCommandNode.type;
    readonly delimiter: string;
    readonly content: string;
    protected readonly isLeaf = true;

    constructor(
        name: string,
        delimiter: string,
        content: string,
        context: ASTNodeContext,
        parser: ASTNodeParser<VerbCommandNode>
    ) {
        super(name, [], context, parser);
        
        this.delimiter = delimiter;
        this.content = content;
    }

    protected async updateWith(reparsedNode: VerbCommandNode): Promise<void> {
        super.updateWith(reparsedNode);

        const writeableSelf = this as Writeable<this>;
        writeableSelf.delimiter = reparsedNode.delimiter;
        writeableSelf.content = reparsedNode.content;
    }
}