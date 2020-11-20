import { LatexLengthSettings, LatexLengthCustomSettings, resolveSettings } from "./LatexLengthSettings";

// Type of standard convertible unit (constant and variable)
export type ConstantUnit = (typeof LatexLength.CONSTANT_UNITS)[number];
export type VariableUnit = (typeof LatexLength.VARIABLE_UNITS)[number];
export type StandardUnit = ConstantUnit | VariableUnit;

// Errors which can be thrown by LatexLength objects
export class LengthParsingError {}
export class LengthConversionError {}

// Type of the result of parsing a potential length
type LengthParsingResult = {
    success: false;
} | {
    success: true;
    value: number;
    unit: string;
    suffix: string;
};

// Initial values of the default settings
const defaultSettings: LatexLengthSettings = {
    ppi: 72, // 72 PPI seems to be a common value, so we use it as default
    defaultUnit: "", // the empty string means there is no default value
    variableUnitsValues: {},
    lengthMacroValues: {},
    maxNbDecimalsPerStandardUnit: {
        "pt": 1,
        "bp": 1,
        "in": 2,
        "cm": 2,
        "mm": 1,
        "px": 0,
        "em": 2,
        "ex": 2
    },
    maxNbDecimalsForLengthMacros: 2
};

// Names amd conversions rates of standard units are based on documents such as
// http://joshua.smcvt.edu/latex2e/Units-of-length.html#Units-of-length
// and
// https://www.overleaf.com/learn/latex/Lengths_in_LaTeX#Units
// 
// All the variable lengths (variable units, length macros) being contextual
// (i.e. they can change at any point in a LaTeX document), they must be specified
// using the appropiate custom setting fields to be used (see LatexLengthSettings).
export class LatexLength {
    static readonly CONSTANT_UNITS = ["pt", "bp", "in", "cm", "mm", "px"] as const;
    static readonly VARIABLE_UNITS = ["em", "ex"] as const;
    static defaultSettings: LatexLengthSettings = defaultSettings;

    // Components of the length
    readonly value: number;
    readonly unit: string;
    readonly suffix: string;

    // Custom settings
    readonly settings: LatexLengthSettings;

    constructor(value: number, unit: string, suffix: string = "", settings: LatexLengthCustomSettings = {}) {
        this.value = value;
        this.unit = unit;
        this.suffix = suffix;

        // Complete settings are resolved everytime a new LatexLength object is created
        // from the given (partial) custom settings and the default (complete) settings
        this.settings = resolveSettings(LatexLength.defaultSettings, settings);
    }

    // The value of a length unit U is said to be 'known' if
    // – U is a constant unit;
    // – U is a variable unit whose value in points is known (in the settings);
    // – U is a length macro whose value in points is known (in the settings).
    private knowsValueOfUnit(unit: string): boolean {
        return LatexLength.isStandardUnit(this.unit)
            || (LatexLength.isVariableUnit(this.unit)
                && this.settings.variableUnitsValues[this.unit] !== undefined)
            || this.settings.lengthMacroValues[this.unit] !== undefined;
    }

    // If the value of the unit is not known, this method returns NaN
    private get valueInPoints(): number {
        return this.knowsValueOfUnit(this.unit)
             ? this.convertToPoints()
             : NaN;
    }

    isConvertibleTo(targetUnit: string): boolean {
        // If the given unit is the same as this length's unit,
        // the value is always convertible
        // (the target value is the value of this length)
        if (this.unit === targetUnit) {
            return true;
        }

        // Otherwise, this length must know the unit of this length AND the target unit
        return this.knowsValueOfUnit(this.unit)
            && this.knowsValueOfUnit(targetUnit);
    }

    private assertConversionToUnitIsPossible(unit: string): void {
        if (!this.isConvertibleTo(unit)) {
            throw new LengthConversionError();
        }
    }

    // Special assertion for constant unit to avoid testing them all one by one
    private assertConversionToConstantUnitIsPossible(): void {
        if (!this.knowsValueOfUnit(this.unit)) {
            throw new LengthConversionError();
        }
    }

    get pt(): number {
        this.assertConversionToConstantUnitIsPossible();
        return this.round(this.valueInPoints, "pt");
    }

    get bp(): number {
        this.assertConversionToConstantUnitIsPossible();
        return this.round((this.valueInPoints / 72.27) * 72, "bp"); // pt -> in -> bp
    }

    get in(): number {
        this.assertConversionToConstantUnitIsPossible();
        return this.round(this.valueInPoints / 72.27, "in"); // pt -> in
    }

    get cm(): number {
        this.assertConversionToConstantUnitIsPossible();
        return this.round((this.valueInPoints / 72.27) * 2.54, "cm"); // pt -> in -> cm
    }

    get mm(): number {
        this.assertConversionToConstantUnitIsPossible();
        return this.round((this.valueInPoints / 72.27) * 25.4, "mm"); // pt -> in -> mm
    }

    get px(): number {
        this.assertConversionToConstantUnitIsPossible();
        return this.round((this.valueInPoints / 72.27) * this.settings.ppi, "px"); // pt -> in -> px
    }

    get em(): number {
        this.assertConversionToUnitIsPossible("em");
        return this.round(this.valueInPoints / this.settings.variableUnitsValues.em, "em"); // pt -> pt
    }

    get ex(): number {
        this.assertConversionToUnitIsPossible("ex");
        return this.round(this.valueInPoints / this.settings.variableUnitsValues.ex, "ex"); // pt -> pt
    }

    convertTo(unit: string): number {
        // If the target unit is the same than the current unit,
        // we can simply return the current value (rounded)
        if (this.unit === unit) {
            return this.round(this.value, this.unit);
        } 

        // If the target unit is standard, use the dedicated getter-style method
        if (LatexLength.isStandardUnit(unit)) {
            return this[unit];
        }
        
        // Otherwise, ensure the current unit can be converted to the target unit
        // and use the adequate macro length value (in points)
        this.assertConversionToUnitIsPossible(unit);
        return this.round(this.valueInPoints / this.settings.lengthMacroValues[unit], unit);
    }

    withValue(value: number, valueUnit?: string): LatexLength {
        // If the given value is not using the same unit as this length, it must be converted first!
        let newValue = (valueUnit && valueUnit !== this.unit)
                     ? new LatexLength(value, valueUnit, this.suffix, this.settings).convertTo(this.unit)
                     : value;

        return new LatexLength(newValue, this.unit, this.suffix, this.settings);
    }

    withUnit(unit: string): LatexLength {
        return new LatexLength(this.convertTo(unit), unit, this.suffix, this.settings);
    }

    toString(round: boolean = true): string {
        // If there is a suffix, prefix it with a space
        const spacedSuffixOrEmptyString = this.suffix ? ` ${this.suffix}` : "";

        // Round the current value if needed
        const valueToPrint = round
                           ? this.round(this.value, this.unit)
                           : this.value;

        // If the rounded value is equal to 1 and the unit is a length macro,
        // do not display any value before the unit (a common LaTeX pattern)
        return (!LatexLength.isStandardUnit(this.unit) && valueToPrint === 1)
             ? `${this.unit}${this.suffix}`
             : `${valueToPrint}${this.unit}${this.suffix}`;
    }

    private round(value: number, unit: string): number {
        return LatexLength.isStandardUnit(unit)
             ? LatexLength.round(value, this.settings.maxNbDecimalsPerStandardUnit[unit])
             : LatexLength.round(value, this.settings.maxNbDecimalsForLengthMacros);
    }

    // Based on cronvel's solution on StackOverflow (https://stackoverflow.com/a/41716722)
    private static round(value: number, maxNbDecimals: number): number {
        const scalingFactor = 10 ** maxNbDecimals;
        return Math.round((value + Number.EPSILON) * scalingFactor)
             / scalingFactor;
    }

    // This internal method is used to convert the current value + unit to a length in points.
    // It is distinct from the convertTo() method in three ways:
    // – convertTo() depends on this method
    //   (because most conversions start from a "normalised" length in points);
    // – it does not check if the conversion is feasible (since it is internal).
    //   It means testing if the conversion is feasaible is public conversion methods!
    // – it does not round the value it outputs (same reasoning).
    private convertToPoints(): number {
        if (!this.knowsValueOfUnit(this.unit)) {
            throw new LengthConversionError();
        }

        switch(this.unit) {
            // Constant units
            case "pt":
                return this.value;
            case "bp":
                return (this.value / 72) * 72.27;  // bp -> in -> pt
            case "in":
                return this.value * 72.27;  // in -> pt
            case "cm":
                return (this.value / 2.54) * 72.27; // cm -> in -> pt
            case "mm":
                return (this.value / 25.4) * 72.27; // mm -> in -> pt
            case "px":
                return (this.value / this.settings.ppi) * 72.27; // px -> in -> pt

            // Variable units
            case "em":
                return this.settings.variableUnitsValues["em"] * this.value;
            case "ex":
                return this.settings.variableUnitsValues["ex"] * this.value;

            // Length macros
            default:
                return this.settings.lengthMacroValues[this.unit] * this.value;
        }
    }

    private static parse(text: string, defaultUnit?: string): LengthParsingResult {
        // Extract a value, an unit and a suffix from the given string
        // Each capturing group may match an empty string,
        // but not all combinations are accepted (see below)
        const regExpResult = /(\d*(?:\.\d+)?)\s*([^\s]*)\s*(.*)/s.exec(text);
        if (regExpResult === null) {
            return { success: false };
        }

        let [_, parsedValue, parsedUnit, parsedSuffix] = regExpResult;

        // If there is a value, simply parse it as a number.
        // If there is no value but the unit is neither empty nor standard
        // (i.e. it is a potentially valid length macro),
        // the value is assumed to equal to 1.
        // 
        // In particular, this enables to parse length
        // which only contain length macro (e.g. "\textwidth")
        let value = 1;
        if (parsedValue !== "") {
            value = parseFloat(parsedValue);
        }
        else if (parsedUnit === "" || LatexLength.isStandardUnit(parsedUnit)) {
            return { success: false };
        }

        // At this point, either there is a value or the unit is neither empty nor standard.
        // If the unit is empty (i.e. but we know the value is not),
        // use the default unit (if any) or fail.
        let unit = parsedUnit;
        if (unit === "") {
            if (defaultUnit) {
                unit = defaultUnit;
            }
            else {
                return { success: false };
            }
        }

        // Return a successful parsing using the value and the unit defined above
        // The suffix is returned as is (we don't attempt to interpret it in any way)
        return {
            success: true,
            value: value,
            unit: unit,
            suffix: parsedSuffix
        };
    }

    static isConstantUnit(candidate: string): candidate is ConstantUnit {
        const standardUnits = LatexLength.CONSTANT_UNITS as readonly string[];
        return standardUnits.includes(candidate);
    }

    static isVariableUnit(candidate: string): candidate is VariableUnit {
        const variableUnits = LatexLength.VARIABLE_UNITS as readonly string[];
        return variableUnits.includes(candidate);
    }

    static isStandardUnit(candidate: string): candidate is StandardUnit {
        return LatexLength.isConstantUnit(candidate)
            || LatexLength.isVariableUnit(candidate);
    }

    static from(text: string, settings: LatexLengthCustomSettings = {}) {
        const parsingResult = LatexLength.parse(text, settings.defaultUnit);
        if (parsingResult.success === false) {
            throw new LengthParsingError();
        }

        return new LatexLength(
            parsingResult.value,
            parsingResult.unit,
            parsingResult.suffix,
            settings
        );
    }
}