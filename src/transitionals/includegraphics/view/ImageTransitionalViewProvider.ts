import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { TransitionalViewProvider } from "../../../webview/transitionals/TransitionalViewProvider";
import { ImageTransitionalView } from "./ImageTransitionalView";


export class ImageTransitionalViewProvider implements TransitionalViewProvider {
    readonly transitionalName = ImageTransitionalView.transitionalName;
    
    createView(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext): ImageTransitionalView {
        return new ImageTransitionalView(contentNode, metadata, context);
    }
}