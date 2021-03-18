import "../../../webview/static-library-apis/katexApi";
import { AbstractVisualisationView } from "../../../webview/visualisations/AbstractVisualisationView";
import { VisualisationViewFactory, VisualisationView } from "../../../webview/visualisations/VisualisationView";
import { WebviewToCoreMessageType } from "../../../shared/messenger/messages";
import { VisualisationMetadata } from "../../../shared/visualisations/types";
import { VisualisationViewContext } from "../../../webview/visualisations/VisualisationViewContext";
import { HtmlUtils } from "../../../shared/utils/HtmlUtils";

function nodeContainsPosition(node: HTMLElement, offsetX: number, offsetY: number): boolean {
    const nodeBox = node.getBoundingClientRect();
    return nodeBox.left <= offsetX
        && nodeBox.right >= offsetX
        && nodeBox.top <= offsetY
        && nodeBox.bottom >= offsetY;
}

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
    private mathCodeKatexPrefix: string;
    private mathCodeKatexSuffix: string;
    
    private viewNode: HTMLElement;
    private instructionsNode: HTMLElement;
    private completeMathCodeNode: HTMLElement;
    private typesetMathNode: HTMLElement;

    private hoveredMathRegionNode: HTMLElement | null;
    private mathCodeIsEditable: boolean;

    // Unique event callbacks
    private viewClickCallback =
        (event: MouseEvent) => { this.onViewMouseClick(event); };
    private typesetMathMouseMoveCallback =
        (event: MouseEvent) => { this.onTypesetMathMouseMove(event); };
    private completeMathCodeFocusCallback =
        (event: FocusEvent) => { this.onCompleteMathCodeFocus(event); };
    private completeMathCodeBlurCallback =
        (event: FocusEvent) => { this.onCompleteMathCodeBlur(event); };
    private completeMathCodeInputCallback =
        (event: Event) => { this.onCompleteMathCodeEdit(event as InputEvent); };
    private completeMathCodeKeydownCallback =
        (event: KeyboardEvent) => { this.onCompleteMathCodeKeydown(event); };

    constructor(contentNode: HTMLElement, metadata: VisualisationMetadata, context: VisualisationViewContext) {
        super(contentNode, metadata, context);

        this.mathCode = this.contentNode.innerText;
        this.mathCodeKatexPrefix = "\\begin{aligned}";
        this.mathCodeKatexSuffix= "\\end{aligned}";

        this.viewNode = document.createElement("div");
        this.viewNode.classList.add("math-container");

        this.instructionsNode = document.createElement("div");
        this.instructionsNode.classList.add("instructions");
        this.viewNode.append(this.instructionsNode);

        this.completeMathCodeNode = document.createElement("div");
        this.completeMathCodeNode.classList.add("complete-math-code");
        this.completeMathCodeNode.setAttribute("contenteditable", "true");
        this.viewNode.append(this.completeMathCodeNode);

        this.typesetMathNode = document.createElement("div");
        this.typesetMathNode.classList.add("typeset-math");
        this.viewNode.append(this.typesetMathNode);
    
        this.hoveredMathRegionNode = null;
        this.mathCodeIsEditable = false;

        this.updateInstructionsNode();
        this.updateCompleteMathCodeNode();
        this.updateTypesetMathNode();

        this.startHandlingEvents();
    }

    get trimmedMathCode(): string {
        return this.mathCode.trim();
    }

    get someMathRegionIsHovered(): boolean {
        return this.hoveredMathRegionNode !== null;
    }

    get hoveredMathRegionCodeRange(): [number, number] {
        // If no math region is currently selected, throw an error
        if (this.hoveredMathRegionNode === null) {
            throw new NoHoveredMathRegionError();
        }

        return this.getMathRegionCodeRangeOfNode(this.hoveredMathRegionNode)!;
    }

    get hoveredMathRegionCodeSubset(): string {
        return this.trimmedMathCode.substring(...this.hoveredMathRegionCodeRange);
    }

    get mathCodeSplitByHoveredRegion(): MathCodeSplitByRange {
        return MathematicsView.splitMathCodeByRange(
            this.trimmedMathCode,
            this.hoveredMathRegionCodeRange
        );
    }

    private getDeepestMathRegionNodeContainingPosition(viewportX: number, viewportY: number): HTMLElement | null {
        if (!nodeContainsPosition(this.typesetMathNode, viewportX, viewportY)) {
            return null;
        }

        const allNodesContainingPosition = document.elementsFromPoint(viewportX, viewportY);
        const mathRegionNodesContainingPositionToCodeRanges: { node: HTMLElement, codeRange: [number, number] }[] = [];
        for (let node of allNodesContainingPosition) {
            const codeRange = MathematicsView.getRawMathRegionCodeRangeOfNode(node as HTMLElement);
            if (codeRange) {
                mathRegionNodesContainingPositionToCodeRanges.push({ node: node as HTMLElement, codeRange: codeRange });
            }
        }
        
        let bestNodeAndCodeRange = null;
        for (let nodeAndCodeRange of mathRegionNodesContainingPositionToCodeRanges) {
            if (!bestNodeAndCodeRange) {
                bestNodeAndCodeRange = nodeAndCodeRange;
                continue;
            }

            // If the code range of the best match contains the current code range, update it
            if (bestNodeAndCodeRange.codeRange[0] < nodeAndCodeRange.codeRange[0]
            || bestNodeAndCodeRange.codeRange[1] > nodeAndCodeRange.codeRange[1]) {
                bestNodeAndCodeRange = nodeAndCodeRange;
            }
        }

        return bestNodeAndCodeRange?.node ?? null;
    }

    // Get the range of LaTeX math code responsible for the math region given its node
    private getMathRegionCodeRangeOfNode(node: HTMLElement): [number, number] | null {
        const rawCodeRange = MathematicsView.getRawMathRegionCodeRangeOfNode(node);
        if (rawCodeRange === null) {
            return null;
        }

        // Otherwise, adapt the raw values to take the prefix and suffix
        // that are added to the actual math code into account
        return [
            rawCodeRange[0] - this.mathCodeKatexPrefix.length,
            rawCodeRange[1] - this.mathCodeKatexPrefix.length
        ];
    }

    private updateInstructionsNode(): void {
        this.instructionsNode.innerHTML = this.mathCodeIsEditable
            ? `Edit the code and <strong>press 'Enter'</strong> (or click outside the code) to apply the changes.`
            : `<strong>Click the code</strong> to edit it or <strong>click a symbol</strong> below to select it in the code.`;
    }

    private updateCompleteMathCodeNode(): void {
        // If the math code is not in an editable state and a region is is hovered,
        // highlight the source of the hovered region
        if (!this.mathCodeIsEditable && this.someMathRegionIsHovered) {
            const splitCode = this.mathCodeSplitByHoveredRegion;
            this.completeMathCodeNode.innerHTML = 
                `<span>${splitCode.codeBefore}</span>` +
                `<span class="hovered-region-code">${splitCode.codeWithin}</span>` +
                `<span>${splitCode.codeAfter}</span>`;
        }
        // Otherwise, simply display the raw code
        else {
            this.completeMathCodeNode.innerHTML = `${this.trimmedMathCode}`;
        }
    }

    // Recursively update parent nodes of nodes with source location data
    // rooted in the typeset math node (until the typeset math node is reached)
    // private completeTypesetMathNodeWithMissingSourceLocationData(): void {
    //     const recursivelyUpdateAncestors = (node: HTMLElement, start: number, end: number) => {
    //         if (node === this.typesetMathNode) {
    //             return;
    //         }

    //         const parentNode = node.parentElement;
    //         if (parentNode) {
    //             const codeRange = this.getMathRegionCodeRangeOfNode(parentNode);
    //             if (!codeRange || codeRange[0] > start) {
    //                 parentNode.setAttribute("data-source-location-start", start.toString());
    //             }
    //             if (!codeRange || codeRange[1] < end) {
    //                 parentNode.setAttribute("data-source-location-end", end.toString());
    //             }

    //             recursivelyUpdateAncestors(parentNode, start, end);
    //         }
    //     };
        
    //     this.typesetMathNode
    //         .querySelectorAll("[data-source-location-start][data-source-location-end]")
    //         .forEach(node => {
    //             const codeRange = MathematicsView.getRawMathRegionCodeRangeOfNode(node as HTMLElement);
    //             if (codeRange) {
    //                 recursivelyUpdateAncestors(node as HTMLElement, codeRange[0], codeRange[1]);
    //             }
    //         });
    // }

    private updateTypesetMathNode(): void {
        // Try to render the current math code using a custom version of the KaTeX library
        try {
            const trimmedMathCodeWithAlignmentSupport = `${this.mathCodeKatexPrefix}${this.trimmedMathCode}${this.mathCodeKatexSuffix}`;
            katex.render(trimmedMathCodeWithAlignmentSupport, this.typesetMathNode, {
                displayMode: true
            });

            // this.completeTypesetMathNodeWithMissingSourceLocationData();
        }
        // If it fails (i.e. throws an exception), display an appropriate error message instead
        catch (error) {
            this.typesetMathNode.innerHTML = `
                <div class="katex-error">
                    <div class="error">The math code cannot be parsed by iLaTeX: <pre>${error.message}</pre></div>
                    <div class="info">Note that iLaTeX may fail at parsing math code that is actually valid (e.g. if you custom math commands).</div>
                </div>
            `;
        }
    }

    private enterMathCodeEditMode(): void {
        if (this.mathCodeIsEditable) {
            return;
        }

        this.mathCodeIsEditable = true;
        this.updateInstructionsNode();
    }

    private exitMathCodeEditMode(): void {
        if (!this.mathCodeIsEditable) {
            return;
        }

        this.mathCodeIsEditable = false;
        this.updateInstructionsNode();

        // Every time the math code stops being editable,
        // tell the model to update the code with the last edited version
        this.messenger.sendMessage({
            type: WebviewToCoreMessageType.NotifyVisualisationModel,
            visualisationUid: this.modelUid,
            title: "set-math-code",
            notification: {
                trimmedMathCode: this.trimmedMathCode
            }
        });
    }

    private onViewMouseClick(event: MouseEvent): void {
        const targetNode = (event.target as HTMLElement);

        // If the math code node was clicked, ignore this click
        if (targetNode.closest(".complete-math-code") !== null) {
            return;
        }

        // If the clicked node is a part of the display maths
        // enter the math code edit mode and select the region of the code
        // that represents the clicked element
        if (this.typesetMathNode.contains(targetNode)) {
            const potentialMathRegionNode = this.getDeepestMathRegionNodeContainingPosition(event.clientX, event.clientY);
            const codeRange = this.getMathRegionCodeRangeOfNode(potentialMathRegionNode as HTMLElement);
            if (!codeRange) {
                return;
            }

            // If the selection fails (e.g. because the indices given by KaTeX are invalid),
            // enter the edit mode (do nothing if it is already on)
            try {
                // Create the range that must be selected in the math code node
                const rangeOfCodeToSelect = document.createRange();
                this.completeMathCodeNode.innerHTML = this.completeMathCodeNode.innerText;
                rangeOfCodeToSelect.setStart(this.completeMathCodeNode.childNodes[0], codeRange[0]);
                rangeOfCodeToSelect.setEnd(this.completeMathCodeNode.childNodes[0], codeRange[1]);

                // Select the range created above
                const currentSelection = window.getSelection();
                currentSelection?.removeAllRanges();
                currentSelection?.addRange(rangeOfCodeToSelect);
            }
            catch (error) {
                this.enterMathCodeEditMode();
            }
        }
    }

    private onTypesetMathMouseMove(event: MouseEvent): void {
        // Always reset the hovered region when the mouse moves over the typeset math
        if (this.hoveredMathRegionNode) {
            this.hoveredMathRegionNode.classList.remove("hovered");
            this.hoveredMathRegionNode = null;
        }

        // If the math code is editable, no hovered region can be highlighted
        if (this.mathCodeIsEditable) {
            return;
        }

        // Set the new hovered math region
        const potentialMathRegionNode = this.getDeepestMathRegionNodeContainingPosition(event.clientX, event.clientY);
        if (potentialMathRegionNode) {
            this.hoveredMathRegionNode = potentialMathRegionNode as HTMLElement;
            this.hoveredMathRegionNode.classList.add("hovered");
        }
        
        // Since a region of the code might have started or stopped to be hovered,
        // update the math code node in any case
        this.updateCompleteMathCodeNode();
    }

    private onCompleteMathCodeFocus(event: FocusEvent) {
        this.enterMathCodeEditMode();
    }

    private onCompleteMathCodeBlur(event: FocusEvent) {
        this.exitMathCodeEditMode();
    }

    private onCompleteMathCodeEdit(event: InputEvent): void {
        this.mathCode = this.completeMathCodeNode.textContent!.trim();
        this.updateTypesetMathNode();
    }

    private onCompleteMathCodeKeydown(event: KeyboardEvent): void {
        // If the down key is Enter, exit the math code edit mode
        if (event.key === "Enter") {
            event.preventDefault();
            this.exitMathCodeEditMode();
        }
    }

    private startHandlingEvents(): void {
        this.viewNode.addEventListener("click", this.viewClickCallback);
        this.typesetMathNode.addEventListener("mousemove", this.typesetMathMouseMoveCallback);

        this.completeMathCodeNode.addEventListener("input", this.completeMathCodeInputCallback);
        this.completeMathCodeNode.addEventListener("focus", this.completeMathCodeFocusCallback);
        this.completeMathCodeNode.addEventListener("blur", this.completeMathCodeBlurCallback);
        this.completeMathCodeNode.addEventListener("keydown", this.completeMathCodeKeydownCallback);
    }

    private stopHandlingEvents(): void {
        this.viewNode.removeEventListener("click", this.viewClickCallback);
        this.typesetMathNode.removeEventListener("mousemove", this.typesetMathMouseMoveCallback);
    
        this.completeMathCodeNode.removeEventListener("input", this.completeMathCodeInputCallback);
        this.completeMathCodeNode.removeEventListener("focus", this.completeMathCodeFocusCallback);
        this.completeMathCodeNode.removeEventListener("blur", this.completeMathCodeBlurCallback);
        this.completeMathCodeNode.removeEventListener("keydown", this.completeMathCodeKeydownCallback);
    }        

    render(): HTMLElement {
        return this.viewNode;
    }

    updateContentWith(newContentNode: HTMLElement): void {
        this.contentNode = newContentNode;
        this.mathCode = this.contentNode.innerText;

        // Reset currently hovered/selected math region (if any) and update various parts od the visualisation
        this.hoveredMathRegionNode = null;
        
        this.updateTypesetMathNode();
        this.updateCompleteMathCodeNode();
    };

    onBeforeVisualisationRemoval(): void {
        this.stopHandlingEvents();
    }

    // Get a source location offset from a math region node
    // Note: the offsets are actually computed by KaTeX's lexer
    // and written in custom HTML attributes in a customised version of KaTeX
    private static getOffsetFromMathRegionNode(node: HTMLElement, attrSuffix: "start" | "end"): number | null {
        const attribute = `data-source-location-${attrSuffix}`;
        if (!node.hasAttribute(attribute)) {
            return null;
        }

        return parseInt(node.getAttribute(attribute)!);
    };

    // Get the raw range of LaTeX math code responsible for the math region given its node
    // Note: since the values are raw, there is no correction for the added prefix and suffix!
    private static getRawMathRegionCodeRangeOfNode(node: HTMLElement): [number, number] | null {
        const start = MathematicsView.getOffsetFromMathRegionNode(node, "start");
        const end = MathematicsView.getOffsetFromMathRegionNode(node, "end");

        if (start === null || end === null) {
            return null;
        }

        return [start, end];
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