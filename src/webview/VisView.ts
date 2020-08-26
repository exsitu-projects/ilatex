export interface VisView {
    readonly visualisationId: string;

    onAfterWebviewStarted(): void;
    onBeforeWebviewClosed(): void;
    
    onBeforeVisualisationDisplayed(): void;
    onAfterVisualisationDisplayed(): void;
    onBeforeVisualisationClosed(): void;
    onAfterVisualisationClosed(): void;
}