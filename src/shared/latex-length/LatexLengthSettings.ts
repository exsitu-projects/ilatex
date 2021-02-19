import { StandardUnit } from "./LatexLength";

// Type of the option used to specify the nb. of decimals to use
// when converting a length to a standard unit
export type NbDecimalsPerStandardUnit = Record<StandardUnit, number>;

// Type of the option used to specify the value in points of standard variable units
// (such as em), which can then be used as convertible units
export type VariableUnitsValues = Record<string, number>;

// Type of the option used to specify the value in points of length macros
// (such as \linewidth), which can then be used as convertible units
export type LengthMacroValues = Record<string, number>;

export interface LatexLengthSettings {
    ppi: number; // PPI = Pixels Per Inch (https://en.wikipedia.org/wiki/Pixel_density)
    defaultUnit: string;
    variableUnitsValues: VariableUnitsValues;
    lengthMacroValues: VariableUnitsValues;
    maxNbDecimalsPerStandardUnit: NbDecimalsPerStandardUnit;
    maxNbDecimalsForLengthMacros: number;
    onlyAcceptConvertibleUnits: boolean;
}

export type LatexLengthCustomSettings =
    Partial<
        Pick<
            LatexLengthSettings,
            Exclude<keyof LatexLengthSettings, "maxNbDecimalsPerUnit">
        > & {
            maxNbDecimalsPerUnit: Partial<NbDecimalsPerStandardUnit>;
        }
    >;

// Create a complete settings object given complete default settings
// and (possibly partial) custom settings
export function resolveSettings(
    defaultSettings: LatexLengthSettings,
    customSettings: LatexLengthCustomSettings
): LatexLengthSettings {
    return {
        ppi: customSettings.ppi ?? defaultSettings.ppi,
        defaultUnit: customSettings.defaultUnit ?? defaultSettings.defaultUnit,
        variableUnitsValues: { ...defaultSettings.variableUnitsValues, ...customSettings.variableUnitsValues ?? {} },
        lengthMacroValues: { ...defaultSettings.lengthMacroValues, ...customSettings.lengthMacroValues ?? {} },
        maxNbDecimalsPerStandardUnit: { ...defaultSettings.maxNbDecimalsPerStandardUnit, ...customSettings.maxNbDecimalsPerUnit ?? {} },
        maxNbDecimalsForLengthMacros: customSettings.maxNbDecimalsForLengthMacros ?? defaultSettings.maxNbDecimalsForLengthMacros,
        onlyAcceptConvertibleUnits: customSettings.onlyAcceptConvertibleUnits ?? defaultSettings.onlyAcceptConvertibleUnits,
    };
}