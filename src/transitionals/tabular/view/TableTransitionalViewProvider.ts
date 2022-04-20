import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { TransitionalViewProvider } from "../../../webview/transitionals/TransitionalViewProvider";
import { TableTransitionalView } from "./TableTransitionalView";

export class TableTransitionalViewProvider implements TransitionalViewProvider {
    readonly transitionalName = TableTransitionalView.transitionalName;
    
    createView(
        contentNode: HTMLElement,
        metadata: TransitionalMetadata,
        context: TransitionalViewContext
    ): TableTransitionalView {
        return new TableTransitionalView(contentNode, metadata, context);
    }
}