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
    maxNbDecimals?: number;
}

export class LengthParsingError {}
export class LengthConversionError {}

export class LatexLength {
    // PPI = Pixels Per Inch (see https://en.wikipedia.org/wiki/Pixel_density)
    private static readonly PPI: number = 72;
    private static readonly CONVERTIBLE_UNITS: string[] = ["pt", "bp", "in", "cm", "mm", "px"];
    private static readonly DEFAULT_MAX_NB_DECIMALS: number = 0;

    // Components of the length
    readonly value: number;
    readonly unit: string;
    readonly suffix: string;

    // Conversion options
    readonly canBeConverted: boolean;
    maxNbDecimals: number;

    // Internal values
    private valueInPoints: number;

    constructor(value: number, unit: string, suffix: string = "", options: LatexLengthOptions = {}) {
        this.value = value;
        this.unit = unit!.trim();
        this.suffix = suffix.trim();

        this.canBeConverted = LatexLength.isConvertibleUnit(this.unit);
        this.maxNbDecimals = options.maxNbDecimals ?? LatexLength.DEFAULT_MAX_NB_DECIMALS;

        this.valueInPoints = this.canBeConverted
                           ? LatexLength.convertToPoints(this.value, this.unit)
                           : NaN;
    }

    get pt(): number {
        this.assertConversionIsPossible();
        return this.round(this.valueInPoints);
    }

    get bp(): number {
        this.assertConversionIsPossible();
        return this.round((this.valueInPoints / 72.27) * 72); // pt -> in -> bp
    }

    get in(): number {
        this.assertConversionIsPossible();
        return this.round(this.valueInPoints / 72.27); // pt -> in
    }

    get cm(): number {
        this.assertConversionIsPossible();
        return this.round((this.valueInPoints / 72.27) * 2.54); // pt -> in -> cm
    }

    get mm(): number {
        this.assertConversionIsPossible();
        return this.round((this.valueInPoints / 72.27) * 25.4); // pt -> in -> mm
    }

    get px(): number {
        this.assertConversionIsPossible();
        return this.round((this.valueInPoints / 72.27) * LatexLength.PPI); // pt -> in -> px
    }

    private round(value: number): number {
        return LatexLength.round(value, this.maxNbDecimals);
    }

    withValue(value: number): LatexLength {
        return new LatexLength(value, this.unit, this.suffix);
    }
    
    assertConversionIsPossible(): void {
        if (!this.canBeConverted) {
            throw new LengthConversionError();
        }
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

    // Based on cronvel's solution on StackOverflow (https://stackoverflow.com/a/41716722)
    private static round(value: number, maxNbDecimals: number): number {
        const scalingFactor = 10 ** maxNbDecimals;
        return Math.round((value + Number.EPSILON) * scalingFactor) / scalingFactor;
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