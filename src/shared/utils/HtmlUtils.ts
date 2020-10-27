export class HtmlUtils {
    static makeAttributesFromKeysOf(object: { [key: string]: string }): string {
        return Object.entries(object)
            .map(([key, value]) => `${key}="${value}"`)
            .join(" ");
    }
}