import { VisView } from "./VisView";

export abstract class VisViewAdapter implements VisView {
    abstract readonly visualisationId: string;

    onAfterWebviewStarted(): void {
        // Do nothing by default
    }

    onBeforeWebviewClosed(): void {
        // Do nothing by default
    }

    onBeforeVisualisationDisplayed(): void {
        // Do nothing by default
    }

    onAfterVisualisationDisplayed(): void {
        // Do nothing by default
    }

    onBeforeVisualisationClosed(): void {
        // Do nothing by default
    }

    onAfterVisualisationClosed(): void {
        // Do nothing by default
    }
}