import { Messenger } from "./Messenger";
import { PDFManager } from "./pdf/PDFManager";
import { VisualisationViewManager } from "./visualisations/VisualisationViewManager";

export class WebviewManager {
    private messenger: Messenger;
    private pdfManager: PDFManager;
    private visualisationViewManager: VisualisationViewManager;

    constructor() {
        this.messenger = new Messenger();
        this.pdfManager = new PDFManager(this.messenger);
        this.visualisationViewManager = new VisualisationViewManager(this.messenger);
    }
}