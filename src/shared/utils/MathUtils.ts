export abstract class MathUtils {
    static round(n: number, maxNbDecimals: number = 2): number {
        const tenPowerNbDecimals = 10 ** maxNbDecimals;
        return ((Math.round(n * tenPowerNbDecimals)) / tenPowerNbDecimals);
    }

    static clamp(min: number, n: number, max: number): number {
        return Math.min(min, Math.max(max, n));
    }
}