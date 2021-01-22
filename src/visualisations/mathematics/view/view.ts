// import { katex } from "./katexApi";
import "./katexApi";
import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView, VisualisationViewInstantiationContext } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";


export class NoSelectedMathRegionError {};

class MathematicsView extends AbstractVisualisationView {
    static readonly visualisationName = "mathematics";
    readonly visualisationName = MathematicsView.visualisationName;

    private mathCode: string;
    
    private viewNode: HTMLElement;
    private completeMathCodeNode: HTMLElement;
    private typesetMathNode: HTMLElement;

    // Reference to the currently selected region of the typeset maths (if any)
    private selectedMathRegionNode: HTMLElement | null;

    // Unique event callbacks
    private typesetMathClickCallback =
        (event: MouseEvent) => { this.onTypesetMathMouseClick(event); };

    // Casted to bypass the overly-limited type of addEventListener?
    private completeMathCodeInputCallback =
        (event: Event) => { this.onCompleteMathCodeEdit(event as InputEvent); };

    constructor(contentNode: HTMLElement, context: VisualisationViewInstantiationContext) {
        super(contentNode, context);

        this.mathCode = this.contentNode.innerText;

        this.viewNode = document.createElement("div");
        this.viewNode.classList.add("math-container");

        this.completeMathCodeNode = document.createElement("div");
        this.completeMathCodeNode.classList.add("complete-math-code");
        this.viewNode.append(this.completeMathCodeNode);

        this.typesetMathNode = document.createElement("div");
        this.typesetMathNode.classList.add("typeset-math");
        this.viewNode.append(this.typesetMathNode);
    
        this.selectedMathRegionNode = null;

        this.updateCompleteMathCodeNode();
        this.updateTypesetMathNode();

        this.startHandlingMouseEvents();
        this.startHandlingInputEvents();
    }

    get trimmedMathCode(): string {
        //return this.contentNode.innerText.trim();
        return this.mathCode.trim();
    }

    get someMathRegionIsSelected(): boolean {
        return this.selectedMathRegionNode !== null;
    }

    get selectedMathRegionCodeOffsetRange(): [number, number] {
        const selectedMathRegionNode = this.selectedMathRegionNode;
        // If no math region is currently selected, throw an error
        if (selectedMathRegionNode === null) {
            throw new NoSelectedMathRegionError();
        }

        // Otherwise, get the range of LaTeX math code responsible for the selected math region
        // and return the related subset of LaTeX math code
        return [
            MathematicsView.getOffsetFromMathRegionNode(selectedMathRegionNode, "start"),
            MathematicsView.getOffsetFromMathRegionNode(selectedMathRegionNode, "end")
        ];
    }

    get selectedMathRegionCodeSubset(): string {
        // If no math region is currently selected, return an empty string
        const selectedMathRegionNode = this.selectedMathRegionNode;
        if (selectedMathRegionNode === null) {
            return "";
        }

        return this.trimmedMathCode.substring(...this.selectedMathRegionCodeOffsetRange);
    }

    private updateCompleteMathCodeNode(): void {
        this,this.completeMathCodeNode.innerHTML = "";

        // If no region is currently selected, simply display the whole piece of code
        // Otherwise, display the whole piece of code AND highlight the source of the currently selected region
        if (!this.someMathRegionIsSelected) {
            this.completeMathCodeNode.innerHTML = `<span contenteditable="true">${this.trimmedMathCode}</span>`;
        }
        else {
            const offsetRange = this.selectedMathRegionCodeOffsetRange;

            const codeBeforeSelectedRegionCode = this.trimmedMathCode.substring(0, offsetRange[0]);
            const selectedRegionCode = this.selectedMathRegionCodeSubset;
            const codeAfterSelectedRegionCode = this.trimmedMathCode.substring(
                Math.min(offsetRange[1], this.trimmedMathCode.length)
            );

            this.completeMathCodeNode.innerHTML = 
                `<span contenteditable="true">${codeBeforeSelectedRegionCode}</span>` +
                `<span contenteditable="true" class="selected-region-code">${selectedRegionCode}</span>` +
                `<span contenteditable="true">${codeAfterSelectedRegionCode}</span>`;
        }
    }

    private updateTypesetMathNode(): void {
        katex.render(this.trimmedMathCode, this.typesetMathNode, {
            displayMode: true
        });
    }

    private onTypesetMathMouseClick(event: MouseEvent): void {
        // Deselect any currently selected region
        if (this.selectedMathRegionNode !== null) {
            this.selectedMathRegionNode.classList.remove("selected-region");
            this.selectedMathRegionNode = null;
        }

        // The new selected math region node is the first ancestor
        // of the clicked element that has source location attributes (if any)
        const potentialMathRegionNode = (event.target as HTMLElement)
            .closest("[data-source-location-start][data-source-location-end]");
        if (potentialMathRegionNode !== null) {
            this.selectedMathRegionNode = potentialMathRegionNode as HTMLElement;
            this.selectedMathRegionNode.classList.add("selected-region");
        }
        
        // In any case, update the complete code + the code of the selected region
        this.updateCompleteMathCodeNode();
    }

    private onCompleteMathCodeEdit(event: InputEvent): void {
        // Update the math code and the typeset math
        this.mathCode = this.completeMathCodeNode.textContent!.trim();
        this.updateTypesetMathNode();

        // Tell the model the code has been updated
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.visualisationUid,
            title: "set-math-code",
            notification: {
                trimmedMathCode: this.trimmedMathCode
            }
        });
    }

    private startHandlingMouseEvents(): void {
        this.typesetMathNode.addEventListener("click", this.typesetMathClickCallback);
    }

    private stopHandlingMouseEvents(): void {
        this.typesetMathNode.removeEventListener("click", this.typesetMathClickCallback);
    }

    private startHandlingInputEvents(): void {
        this.completeMathCodeNode.addEventListener("input", this.completeMathCodeInputCallback);
    }

    private stopHandlingInputEvents(): void {
        this.completeMathCodeNode.removeEventListener("input", this.completeMathCodeInputCallback);
    }

    render(): HTMLElement {
        return this.viewNode;
    }

    updateWith(newContentNode: HTMLElement): void {
        super.updateWith(newContentNode);
        this.contentNode = newContentNode;
        this.mathCode = this.contentNode.innerText;

        // Deselect the currently selected math region (if any) and update related nodes
        this.selectedMathRegionNode = null;

        this.updateCompleteMathCodeNode();
        this.updateTypesetMathNode();
    };

    // Get a source location offset from a math region node
    // Note: the offsets are actually computed by KaTeX's lexer
    // and written in custom HTMl attributes in a customised version of KaTeX
    private static getOffsetFromMathRegionNode = (node: HTMLElement, attrSuffix: "start" | "end"): number => {
        return parseInt(
            node.getAttribute(`data-source-location-${attrSuffix}`)!
        );
    };
}

export class MathematicsViewFactory implements VisualisationViewFactory {
    readonly visualisationName = MathematicsView.visualisationName;
    
    createView(contentNode: HTMLElement, context: VisualisationViewInstantiationContext): VisualisationView {
        return new MathematicsView(contentNode, context);
    }
}