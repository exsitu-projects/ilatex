import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { TransitionalViewProvider } from "../../../webview/transitionals/TransitionalViewProvider";
import { TemplateTransitionalView } from "./view";

export class TemplateTransitionalViewProvider implements TransitionalViewProvider {
    readonly transitionalName = TemplateTransitionalView.transitionalName;
    
    createView(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext): TemplateTransitionalView {
        return new TemplateTransitionalView(contentNode, metadata, context);
    }
}