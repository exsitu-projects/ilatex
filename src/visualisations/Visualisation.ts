import { ASTNode } from "../ast/LatexASTNode";

export type VisualisationID = number;

export abstract class Visualisation<T extends ASTNode = ASTNode> {
    private static maximumId: VisualisationID = 1;

    readonly id: number;
    readonly node: T;
    protected props: Record<string, string>;
    abstract readonly name: string;

    constructor(node: T) {
        this.id = Visualisation.generateUniqueId();
        this.node = node;
        this.props = {};
    }

    protected initProps(): void {
        this.props = {
            ...this.props,

            "class": "visualisation",
            "data-id": this.id.toString(),
            "data-name": this.name
        };
    }

    protected renderPropsAsHTML(): string {
        return Object.keys(this.props)
            .map(key => `${key}="${this.props[key]}"`)
            .join("\n");
    }

    protected abstract renderContentAsHTML(): string;

    renderAsHTML(): string {
        return `
            <div ${this.renderPropsAsHTML()}>
                ${this.renderContentAsHTML()}
            </div>
        `;
    }

    private static generateUniqueId(): VisualisationID {
        Visualisation.maximumId += 1;
        return Visualisation.maximumId;
    }
}