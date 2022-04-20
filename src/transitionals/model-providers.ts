import { TransitionalModelProvider } from "../core/transitionals/TransitionalModelProvider";
import { GridLayoutTransitionalModelProvider } from "./gridlayout/model/GridLayoutTransitionalModelProvider";
import { ImageTransitionalModelProvider } from "./includegraphics/model/ImageTransitionalModelProvider";
import { MathematicalFormulaTransitionalModelProvider } from "./mathematics/model/MathematicalFormulaTransitionalModelProvider";
import { TableTransitionalModelProvider } from "./tabular/model/TableTransitionalModelProvider";

export const TRANSITIONAL_MODEL_PROVIDERS: TransitionalModelProvider[] = [
    new MathematicalFormulaTransitionalModelProvider(),
    new TableTransitionalModelProvider(),
    new ImageTransitionalModelProvider(),
    new GridLayoutTransitionalModelProvider()
];