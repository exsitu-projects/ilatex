export class LengthParsingError {}
export class LengthConversionError {}

type LengthParsingResult = {
    success: false;
} | {
    success: true;
    value: number;
    unit: string;
    suffix: string;
};


export class LatexLength {
    // PPI = Pixels Per Inch (see https://en.wikipedia.org/wiki/Pixel_density)
    private static readonly PPI = 72;
    private static readonly CONVERTIBLE_UNITS = ["pt", "in", "cm", "mm", "px"];

    readonly text: string;
    readonly value: number;
    readonly unit: string;
    readonly suffix: string;
    readonly canBeConverted: boolean;
    private valueInPoints: number;

    constructor(text: string);
    constructor(value: number, unit: string, suffix?: string);
    constructor(textOrValue: string | number, unit?: string, suffix: string = "")
    {
        // First constructor
        if (typeof textOrValue === "string") {
            this.text = textOrValue;

            const parsingResult = LatexLength.parseLength(this.text);
            if (parsingResult.success === false) {
                throw new LengthParsingError();
            }

            this.value = parsingResult.value;
            this.unit = parsingResult.unit;
            this.suffix = parsingResult.suffix;
        }
        // Second constructor
        else {
            this.value = textOrValue;
            this.unit = unit!.trim();
            this.suffix = suffix.trim();
            this.text = `${this.value.toString()}${this.unit}${this.suffix}`;
        }

        this.canBeConverted = LatexLength.isConvertibleUnit(this.unit);
        this.valueInPoints = this.canBeConverted
                           ? LatexLength.convertToPoints(this.value, this.unit)
                           : NaN;
    }

    get pt(): number {
        this.assertConversionIsPossible();
        return this.valueInPoints;
    }

    get in(): number {
        this.assertConversionIsPossible();
        return this.valueInPoints / 72.27; // pt -> in
    }

    get cm(): number {
        this.assertConversionIsPossible();
        return (this.valueInPoints / 72.27) * 2.54; // pt -> in -> cm
    }

    get mm(): number {
        this.assertConversionIsPossible();
        return (this.valueInPoints / 72.27) * 25.4; // pt -> in -> mm
    }

    get px(): number {
        this.assertConversionIsPossible();
        return (this.valueInPoints / 72.27) * LatexLength.PPI; // pt -> in -> px
    }
    
    assertConversionIsPossible(): void {
        if (!this.canBeConverted) {
            throw new LengthConversionError();
        }
    }

    withValue(value: number): LatexLength {
        return new LatexLength(value, this.unit, this.suffix);
    }

    private static parseLength(text: string): LengthParsingResult {
        const regExpResult = /(\d*\.?\d*)(\s*[^\s]+)(.*)/s.exec(text);
        if (regExpResult === null) {
            return { success: false };
        }

        const [_, valueStr, unit, suffix] = regExpResult;
        const value = parseFloat(valueStr);
        if (Number.isNaN(value)) {
            return { success: false };
        }

        return {
            success: true,
            value: value,
            unit: unit.trim(),
            suffix: suffix.trim()
        };
    }

    private static isConvertibleUnit(unit: string) {
        return LatexLength.CONVERTIBLE_UNITS.includes(unit);
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
                return value;
            default:
                throw new LengthConversionError();
        }
    }
}