import { ASTNode } from "./ASTNode";
import { RangeInFile } from "../../utils/RangeInFile";
import { language } from "../LatexASTParsers";
import { LatexASTVisitor } from "../visitors/LatexASTVisitor";
import { CommandNode } from "./CommandNode";
import { CurlyBracesParameterBlockNode } from "./CurlyBracesParameterBlockNode";
import { SquareBracesParameterBlockNode } from "./SquareBracesParameterBlockNode";
import { EmptyASTValue } from "../parsers";


export type EnvironmentNodeParameters = (
    | CurlyBracesParameterBlockNode
    | SquareBracesParameterBlockNode
    | EmptyASTValue
)[];


export class EnvironmentNode<BodyContent = ASTNode> extends ASTNode {
    static readonly type = "environment" as const;
    static readonly parser = (text: string) => language.block;

    readonly type = EnvironmentNode.type;
    readonly parser = EnvironmentNode.parser;

    readonly name: string;
    readonly beginCommand: CommandNode;
    readonly parameters: EnvironmentNodeParameters;
    readonly body: BodyContent;
    readonly endCommand: CommandNode;

    constructor(
        name: string,
        beginCommand: CommandNode,
        parameters: EnvironmentNodeParameters,
        body: BodyContent,
        endCommand: CommandNode,
        range: RangeInFile
    ) {
        super(range);
        
        this.name = name;
        this.beginCommand = beginCommand;
        this.parameters = parameters;
        this.body = body;
        this.endCommand = endCommand;
    }

    visitWith(
        visitor: LatexASTVisitor,
        depth: number = 0,
        maxDepth: number = Number.MAX_SAFE_INTEGER
    ) {
        // TODO: implement
    };
}