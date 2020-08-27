import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { Messenger } from "../../../webview/Messenger";

class TabularView extends AbstractVisualisationView {
    static readonly visualisationName = "tabular";
    readonly visualisationName = TabularView.visualisationName;

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

export default class TabularViewFactory implements VisualisationViewFactory {
    readonly visualisationName = TabularView.visualisationName;
    
    createView(contentNode: HTMLElement, messenger: Messenger): VisualisationView {
        return new TabularView(contentNode, messenger);
    }
}