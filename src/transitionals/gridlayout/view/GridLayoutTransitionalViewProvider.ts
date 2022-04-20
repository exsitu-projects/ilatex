import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { TransitionalViewProvider } from "../../../webview/transitionals/TransitionalViewProvider";
import { GridLayoutTransitionalView } from "./GridLayoutTransitionalView";

export class GridLayoutTransitionalViewProvider implements TransitionalViewProvider {
    readonly transitionalName = GridLayoutTransitionalView.transitionalName;
    
    createView(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext): GridLayoutTransitionalView {
        return new GridLayoutTransitionalView(contentNode, metadata, context);
    }
}