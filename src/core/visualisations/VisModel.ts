import { Visualisation } from "./Visualisation";

export interface VisModel {
    provideModel(): Visualisation;
}