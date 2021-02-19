// import { katex } from "./katexApi";
import "./katexApi";
import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { VisualisationMetadata } from "../../../shared/visualisations/types";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";

interface MathCodeSplitByRange {
    code: string;
    range: [number, number];

    codeBefore: string;
    codeWithin: string;
    codeAfter: string;
}

export class NoSelectedMathRegionError {};
export class NoHoveredMathRegionError {};

class MathematicsView extends AbstractVisualisationView {
    static readonly visualisationName = "mathematics";
    readonly visualisationName = MathematicsView.visualisationName;

    private mathCode: string;
    
    private viewNode: HTMLElement;
    private completeMathCodeNode: HTMLElement;
    private typesetMathNode: HTMLElement;

    // References to regions of the typeset maths (or null if there isn't)
    private hoveredMathRegionNode: HTMLElement | null;
    private selectedMathRegionNode: HTMLElement | null;

    // Unique event callbacks
    private viewClickCallback =
        (event: MouseEvent) => { this.onViewMouseClick(event); };
    private typesetMathMouseMoveCallback =
        (event: MouseEvent) => { this.onTypesetMathMouseMove(event); };
    private completeMathCodeInputCallback =
        (event: Event) => { this.onCompleteMathCodeEdit(event as InputEvent); };  // Casted to bypass the overly-limited type of addEventListener?

    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext) {
        super(contentNode, metadata, context);

        this.mathCode = this.contentNode.innerText;

        this.viewNode = document.createElement("div");
        this.viewNode.classList.add("math-container");

        this.completeMathCodeNode = document.createElement("div");
        this.completeMathCodeNode.classList.add("complete-math-code");
        this.viewNode.append(this.completeMathCodeNode);

        this.typesetMathNode = document.createElement("div");
        this.typesetMathNode.classList.add("typeset-math");
        this.viewNode.append(this.typesetMathNode);
    
        this.hoveredMathRegionNode = null;
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

    get someMathRegionIsHovered(): boolean {
        return this.hoveredMathRegionNode !== null;
    }

    get someMathRegionIsSelected(): boolean {
        return this.selectedMathRegionNode !== null;
    }

    get hoveredMathRegionCodeRange(): [number, number] {
        // If no math region is currently selected, throw an error
        if (this.hoveredMathRegionNode === null) {
            throw new NoHoveredMathRegionError();
        }

        return MathematicsView.getMathRegionCodeRangeFrom(this.hoveredMathRegionNode);
    }

    get selectedMathRegionCodeRange(): [number, number] {
        // If no math region is currently selected, throw an error
        if (this.selectedMathRegionNode === null) {
            throw new NoSelectedMathRegionError();
        }

        return MathematicsView.getMathRegionCodeRangeFrom(this.selectedMathRegionNode);
    }

    get hoveredMathRegionCodeSubset(): string {
        return this.trimmedMathCode.substring(...this.hoveredMathRegionCodeRange);
    }

    get selectedMathRegionCodeSubset(): string {
        return this.trimmedMathCode.substring(...this.selectedMathRegionCodeRange);
    }

    get mathCodeSplitByHoveredRegion(): MathCodeSplitByRange {
        return MathematicsView.splitMathCodeByRange(
            this.trimmedMathCode,
            this.hoveredMathRegionCodeRange
        );
    }

    get mathCodeSplitBySelectedRegion(): MathCodeSplitByRange {
        return MathematicsView.splitMathCodeByRange(
            this.trimmedMathCode,
            this.selectedMathRegionCodeRange
        );
    }

    private updateCompleteMathCodeNode(): void {
        // 1. If there are both a selected and a hovered region, highlight each region
        if (this.someMathRegionIsSelected && this.someMathRegionIsHovered) {
            // There are five possibilities to consider here...
            // Note: since the code cannot be edited while a region is being highlighted,
            // there is no need for conteneditable="true" here!
            const selectedRegionSplitCode = this.mathCodeSplitBySelectedRegion;
            const hoveredRegionSplitCode = this.mathCodeSplitByHoveredRegion;

            // 1.1. the hovered region is THE SAME REGION THAN the selected region
            if (hoveredRegionSplitCode.range[0] === selectedRegionSplitCode.range[0]
            &&  hoveredRegionSplitCode.range[1] === selectedRegionSplitCode.range[1]) {
                console.warn("case 1");
                this.completeMathCodeNode.innerHTML = 
                    `<span>${selectedRegionSplitCode.codeBefore}</span>` +
                    `<span class="selected-region-code hovered-region-code">${selectedRegionSplitCode.codeWithin}</span>` +
                    `<span>${selectedRegionSplitCode.codeAfter}</span>`;
            }
            // 1.2. the hovered region is SURROUNDING the selected region
            else if (hoveredRegionSplitCode.range[0] <= selectedRegionSplitCode.range[0]
                 &&  hoveredRegionSplitCode.range[1] >= selectedRegionSplitCode.range[1]) {
                console.warn("case 2");
                const nonSelectedHoveredRegionCodePrefix = this.trimmedMathCode.substring(
                    hoveredRegionSplitCode.range[0], selectedRegionSplitCode.range[0]
                );
                const nonSelectedHoveredRegionCodeSuffix = this.trimmedMathCode.substring(
                    selectedRegionSplitCode.range[1], hoveredRegionSplitCode.range[1]
                );

                this.completeMathCodeNode.innerHTML = 
                    `<span>${hoveredRegionSplitCode.codeBefore}</span>` +
                    `<span class="hovered-region-code">${nonSelectedHoveredRegionCodePrefix}` +
                    `<span class="selected-region-code">${selectedRegionSplitCode.codeWithin}</span>` +
                    `${nonSelectedHoveredRegionCodeSuffix}</span>` +
                    `<span>${hoveredRegionSplitCode.codeAfter}</span>`;                
            }
            // 1.3. the hovered region is WITHIN the selected region
            else if (hoveredRegionSplitCode.range[0] >= selectedRegionSplitCode.range[0]
                 &&  hoveredRegionSplitCode.range[1] <= selectedRegionSplitCode.range[1]) {
                console.warn("case 3");
                const nonHoveredSelectedRegionCodePrefix = this.trimmedMathCode.substring(
                    selectedRegionSplitCode.range[0], hoveredRegionSplitCode.range[0]
                );
                const nonHoveredSelectedRegionCodeSuffix = this.trimmedMathCode.substring(
                    hoveredRegionSplitCode.range[1], selectedRegionSplitCode.range[1]
                );

                this.completeMathCodeNode.innerHTML = 
                    `<span>${selectedRegionSplitCode.codeBefore}</span>` +
                    `<span class="hovered-region-code">${nonHoveredSelectedRegionCodePrefix}` +
                    `<span class="selected-region-code">${hoveredRegionSplitCode.codeWithin}</span>` +
                    `${nonHoveredSelectedRegionCodeSuffix}</span>` +
                    `<span>${selectedRegionSplitCode.codeAfter}</span>`;                   
            }
            // 1.4. the hovered region is BEFORE the selected region
            else if (hoveredRegionSplitCode.range[1] <= selectedRegionSplitCode.range[0]) {
                console.warn("case 4");
                const codeBetweenHoveredAndSelectedRegions = this.trimmedMathCode.substring(
                    hoveredRegionSplitCode.range[1],
                    selectedRegionSplitCode.range[0]
                );

                this.completeMathCodeNode.innerHTML = 
                    `<span>${hoveredRegionSplitCode.codeBefore}</span>` +
                    `<span class="hovered-region-code">${hoveredRegionSplitCode.codeWithin}</span>` +
                    `<span>${codeBetweenHoveredAndSelectedRegions}</span>` +
                    `<span class="selected-region-code">${selectedRegionSplitCode.codeWithin}</span>` +
                    `<span>${selectedRegionSplitCode.codeAfter}</span>`;    
            }
            // 1.5. the hovered region is AFTER the selected region
            else if (hoveredRegionSplitCode.range[0] >= selectedRegionSplitCode.range[1]) {
                console.warn("case 5");
                const codeBetweenSelectedAndHoveredRegions = this.trimmedMathCode.substring(
                    selectedRegionSplitCode.range[1],
                    hoveredRegionSplitCode.range[0]
                );

                this.completeMathCodeNode.innerHTML = 
                    `<span>${selectedRegionSplitCode.codeBefore}</span>` +
                    `<span class="selected-region-code">${selectedRegionSplitCode.codeWithin}</span>` +
                    `<span>${codeBetweenSelectedAndHoveredRegions}</span>` +
                    `<span class="hovered-region-code">${hoveredRegionSplitCode.codeWithin}</span>` +
                    `<span>${hoveredRegionSplitCode.codeAfter}</span>`;                    
            }
        }

        // 2. If a region is selected but no region is hovered,
        // highlight the source of the currently SELECTED region AND make the code editable
        else if (this.someMathRegionIsSelected) {
            const splitCode = this.mathCodeSplitBySelectedRegion;
            this.completeMathCodeNode.innerHTML = 
                `<span contenteditable="true">${splitCode.codeBefore}</span>` +
                `<span contenteditable="true" class="selected-region-code">${splitCode.codeWithin}</span>` +
                `<span contenteditable="true">${splitCode.codeAfter}</span>`;
        }

        // 3. If no region is selected but a region is hovered, highlight the source of the currently HOVERED region
        else if (this.someMathRegionIsHovered) {
            const splitCode = this.mathCodeSplitByHoveredRegion;
            this.completeMathCodeNode.innerHTML = 
                `<span>${splitCode.codeBefore}</span>` +
                `<span class="selected-region-code">${splitCode.codeWithin}</span>` +
                `<span>${splitCode.codeAfter}</span>`;
        }

        // 4. Otherwise, if no region is currently hovered nor selected, only display an editable version of the code
        else {
            this.completeMathCodeNode.innerHTML = `<span contenteditable="true">${this.trimmedMathCode}</span>`;
        }
    }

    private updateTypesetMathNode(): void {
        katex.render(this.trimmedMathCode, this.typesetMathNode, {
            displayMode: true
        });
    }

    private deselectMathRegion(): void {
        if (this.selectedMathRegionNode !== null) {
            this.selectedMathRegionNode.classList.remove("selected-region");
            this.selectedMathRegionNode = null;
        }
    }

    private onViewMouseClick(event: MouseEvent): void {
        const targetNode = (event.target as HTMLElement);

        // If the math code node was clicked, ignore this click
        // (to enable the user to edit code while a region is selected)
        if (targetNode.closest(".complete-math-code") !== null) {
            return;
        }

        // Otherwise, the new selected math region node is the first ancestor
        // of the clicked element that has source location attributes (if any)
        this.deselectMathRegion();

        const potentialMathRegionNode = targetNode.closest("[data-source-location-start][data-source-location-end]");
        if (potentialMathRegionNode !== null) {
            this.selectedMathRegionNode = potentialMathRegionNode as HTMLElement;
            this.selectedMathRegionNode.classList.add("selected-region");
        }
        
        // Since the selected math region may have changed, update the view
        this.updateCompleteMathCodeNode();
    }

    private onTypesetMathMouseMove(event: MouseEvent): void {
        // The new hovered math region is either the math region below the mouse pointer
        // (i.e. the first matching ancestor node of the event target exists) or there is none
        this.hoveredMathRegionNode = null;

        const potentialMathRegionNode = (event.target as HTMLElement)
            .closest("[data-source-location-start][data-source-location-end]");
        if (potentialMathRegionNode !== null) {
            this.hoveredMathRegionNode = potentialMathRegionNode as HTMLElement;
        }
        
        // In any case, update the view
        this.updateCompleteMathCodeNode();
    }

    private onCompleteMathCodeEdit(event: InputEvent): void {
        // Update the math code and the typeset math
        this.mathCode = this.completeMathCodeNode.textContent!.trim();
        this.updateTypesetMathNode();

        // Tell the model the code has been updated
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "set-math-code",
            notification: {
                trimmedMathCode: this.trimmedMathCode
            }
        });
    }

    private startHandlingMouseEvents(): void {
        this.viewNode.addEventListener("click", this.viewClickCallback);
        this.typesetMathNode.addEventListener("mousemove", this.typesetMathMouseMoveCallback);
    }

    private stopHandlingMouseEvents(): void {
        this.viewNode.removeEventListener("click", this.viewClickCallback);
        this.typesetMathNode.removeEventListener("mousemove", this.typesetMathMouseMoveCallback);
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

    updateContentWith(newContentNode: HTMLElement): void {
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
    private static getOffsetFromMathRegionNode(node: HTMLElement, attrSuffix: "start" | "end"): number {
        return parseInt(
            node.getAttribute(`data-source-location-${attrSuffix}`)!
        );
    };

    // Get the range of LaTeX math code responsible for the math region given its node
    private static getMathRegionCodeRangeFrom(node: HTMLElement): [number, number] {
        return [
            MathematicsView.getOffsetFromMathRegionNode(node, "start"),
            MathematicsView.getOffsetFromMathRegionNode(node, "end")
        ];
    }

    // Split LaTeX math code by the given range,
    // yielding the code before/within/after the given range
    private static splitMathCodeByRange(code: string, range: [number, number]): MathCodeSplitByRange {
        return {
            code: code,
            range: range,

            codeBefore: code.substring(0, range[0]),
            codeWithin: code.substring(range[0], range[1]),
            codeAfter: code.substring(Math.min(range[1], code.length))
        };
    }
}

export class MathematicsViewFactory implements VisualisationViewFactory {
    readonly visualisationName = MathematicsView.visualisationName;
    
    createView(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext): VisualisationView {
        return new MathematicsView(contentNode, metadata, context);
    }
}