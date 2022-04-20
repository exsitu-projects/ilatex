import { TransitionalViewProvider } from "../webview/transitionals/TransitionalViewProvider";
import { GridLayoutTransitionalViewProvider } from "./gridlayout/view/GridLayoutTransitionalViewProvider";
import { ImageTransitionalViewProvider } from "./includegraphics/view/ImageTransitionalViewProvider";
import { MathematicalFormulaTransitionalViewProvider } from "./mathematics/view/MathematicalFormulaTransitionalViewProvider";
import { TableTransitionalViewProvider } from "./tabular/view/TableTransitionalViewProvider";

export const TRANSITIONAL_VIEW_PROVIDERS: TransitionalViewProvider[] = [
    new MathematicalFormulaTransitionalViewProvider(),
    new TableTransitionalViewProvider(),
    new ImageTransitionalViewProvider(),
    new GridLayoutTransitionalViewProvider()
];