export class ImpossibleConversionError {}

export class LatexLength {
    // PPI = Pixels Per Inch (see https://en.wikipedia.org/wiki/Pixel_density)
    private static readonly PPI = 72;
    private static readonly ACCEPTED_UNITS = ["pt", "in", "cm", "mm", "px"];

    readonly text: string | null;
    readonly canBeConverted: boolean;
    private points: number;

    constructor(text: string);
    constructor(value: number, unit: string);
    constructor(textOrValue: string | number, unit: string = "pt")
    {
        if (typeof textOrValue === "string") {
            this.text = textOrValue;
            const numericValue = LatexLength.parseNumericValue(this.text);
            const unit = LatexLength.parseUnit(this.text);

            this.canBeConverted =  (numericValue !== null)
                                && (unit !== null)
                                && LatexLength.isAcceptedUnit(unit);

            this.points = this.canBeConverted
                        ? LatexLength.convertToPoints(numericValue as number, unit as string)
                        : 0;
        }
        else {
            this.text = `${textOrValue.toString()}${unit}`;
            this.canBeConverted = LatexLength.isAcceptedUnit(unit);
            this.points = this.canBeConverted
                        ? LatexLength.convertToPoints(textOrValue as number, unit)
                        : 0;
        }
    }

    get pt(): number {
        this.assertConversionIsPossible();
        return this.points;
    }

    get in(): number {
        this.assertConversionIsPossible();
        return this.points / 72.27; // pt -> in
    }

    get cm(): number {
        this.assertConversionIsPossible();
        return (this.points / 72.27) * 2.54; // pt -> in -> cm
    }

    get mm(): number {
        this.assertConversionIsPossible();
        return (this.points / 72.27) * 25.4; // pt -> in -> mm
    }

    get px(): number {
        this.assertConversionIsPossible();
        return (this.points / 72.27) * LatexLength.PPI; // pt -> in -> px
    }

    private static isAcceptedUnit(unit: string) {
        return LatexLength.ACCEPTED_UNITS.includes(unit);
    }

    private static parseNumericValue(lengthText: string): number | null {
        const potentialValue = parseFloat(lengthText);
        return Number.isNaN(potentialValue) ? null : potentialValue;
    }

    private static parseUnit(lengthText: string): string | null {
        const regExpResults = /\d*\.?\d*\s*(.+)/i.exec(lengthText);
        return regExpResults === null ? null : regExpResults[1];
    }

    assertConversionIsPossible(): void {
        if (!this.canBeConverted) {
            throw new ImpossibleConversionError();
        }
    }

    // Based on units and rates listed on webpages such as
    // http://joshua.smcvt.edu/latex2e/Units-of-length.html#Units-of-length
    // and
    // https://www.overleaf.com/learn/latex/Lengths_in_LaTeX#Units
    private static convertToPoints(value: number, unit: string): number {
        switch(unit) {
            case "in":
                return value * 72.27;  // in -> pt
            case "cm":
                return (value / 2.54) * 72.27; // cm -> in -> pt
            case "mm":
                return (value / 25.4) * 72.27; // mm -> in -> pt
            case "px":
                return (value / LatexLength.PPI) * 72.27; // px -> in -> pt
            case "pt":
            default:
                return value;
        }
    }
}