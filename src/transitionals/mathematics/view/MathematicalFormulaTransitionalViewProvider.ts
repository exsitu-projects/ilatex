import { TransitionalMetadata } from "../../../shared/transitionals/types";
import { TransitionalViewContext } from "../../../webview/transitionals/TransitionalViewContext";
import { TransitionalViewProvider } from "../../../webview/transitionals/TransitionalViewProvider";
import { MathematicalFormulaTransitionalView } from "./MathematicalFormulaTransitionalView";

export class MathematicalFormulaTransitionalViewProvider implements TransitionalViewProvider {
    readonly transitionalName = MathematicalFormulaTransitionalView.transitionalName;
    
    createView(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext): MathematicalFormulaTransitionalView {
        return new MathematicalFormulaTransitionalView(contentNode, metadata, context);
    }
}