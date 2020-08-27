import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { Messenger } from "../../../webview/Messenger";

class GridLayoutView extends AbstractVisualisationView {
    static readonly visualisationName = "gridlayout";
    readonly visualisationName = GridLayoutView.visualisationName;

    constructor(contentNode: HTMLElement, messenger: Messenger) {
        super(contentNode, messenger);
    }

    render(): HTMLElement {
        // TODO
    }

    updateWith(newContentNode: HTMLElement): void {
        // TODO
    }
    
}

export default class GridLayoutViewFactory implements VisualisationViewFactory {
    readonly visualisationName = GridLayoutView.visualisationName;
    
    createView(contentNode: HTMLElement, messenger: Messenger): VisualisationView {
        return new GridLayoutView(contentNode, messenger);
    }
}