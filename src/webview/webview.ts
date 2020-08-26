import { VisView } from "./VisView";

import * as VisA from "../visualisations/vis-a/view/view";
import * as VisB from "../visualisations/vis-b/view/view";

const views: VisView[] = [
    new VisA.View(),
    new VisB.View()
];

document.addEventListener("DOMContentLoaded", event => {
    console.log(views);
});