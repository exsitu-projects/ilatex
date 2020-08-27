import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { Messenger } from "../../../webview/Messenger";

class IncludegraphicsView extends AbstractVisualisationView {
    static readonly visualisationName = "includegraphics";
    readonly visualisationName = IncludegraphicsView.visualisationName;

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
    readonly visualisationName = IncludegraphicsView.visualisationName;
    
    createView(contentNode: HTMLElement, messenger: Messenger): VisualisationView {
        return new IncludegraphicsView(contentNode, messenger);
    }
}