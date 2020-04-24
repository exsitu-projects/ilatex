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

export interface LatexLengthOptions {
    defaultUnit?: string;
}


export class LatexLength {
    // PPI = Pixels Per Inch (see https://en.wikipedia.org/wiki/Pixel_density)
    private static readonly PPI = 72;
    private static readonly CONVERTIBLE_UNITS = ["pt", "bp", "in", "cm", "mm", "px"];

    readonly value: number;
    readonly unit: string;
    readonly suffix: string;
    readonly canBeConverted: boolean;
    private valueInPoints: number;

    constructor(value: number, unit: string, suffix: string = "", options: LatexLengthOptions = {}) {
        this.value = value;
        this.unit = unit!.trim();
        this.suffix = suffix.trim();

        this.canBeConverted = LatexLength.isConvertibleUnit(this.unit);
        this.valueInPoints = this.canBeConverted
                           ? LatexLength.convertToPoints(this.value, this.unit)
                           : NaN;
    }

    get pt(): number {
        this.assertConversionIsPossible();
        return this.valueInPoints;
    }

    get bp(): number {
        this.assertConversionIsPossible();
        return (this.valueInPoints / 72.27) * 72; // pt -> in -> bp
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

    private static parseLength(text: string, defaultUnit?: string): LengthParsingResult {
        const regExpResult = /(\d*\.?\d*)(\s*[^\s]*)(.*)/s.exec(text);
        if (regExpResult === null) {
            return { success: false };
        }

        let [_, valueStr, unit, suffix] = regExpResult;
        const value = parseFloat(valueStr);
        if (Number.isNaN(value)) {
            return { success: false };
        }

        if (defaultUnit && unit.trim() === "") {
            unit = defaultUnit;
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
            case "pt":
                return value;
            case "bp":
                return (value / 72) * 72.27;  // bp -> in -> pt
            case "in":
                return value * 72.27;  // in -> pt
            case "cm":
                return (value / 2.54) * 72.27; // cm -> in -> pt
            case "mm":
                return (value / 25.4) * 72.27; // mm -> in -> pt
            case "px":
                return (value / LatexLength.PPI) * 72.27; // px -> in -> pt
            default:
                throw new LengthConversionError();
        }
    }

    static from(text: string, options?: LatexLengthOptions) {
        const parsingResult = LatexLength.parseLength(text, options?.defaultUnit);
        if (parsingResult.success === false) {
            throw new LengthParsingError();
        }

        return new LatexLength(
            parsingResult.value,
            parsingResult.unit,
            parsingResult.suffix,
            options
        );
    }
}