import { TransitionalMetadata } from "../../shared/transitionals/types";
import { TransitionalView } from "./TransitionalView";
import { TransitionalViewContext } from "./TransitionalViewContext";

export interface TransitionalViewProvider {
    readonly transitionalName: string;
    createView(contentNode: HTMLElement, metadata: TransitionalMetadata, context: TransitionalViewContext): TransitionalView;
}