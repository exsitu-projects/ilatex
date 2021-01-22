// Declare the type of the global 'katex' object provided by the KaTeX library

interface Katex {
    render(mathExpression: string, container: HTMLElement, options?: any): void;
    renderToString(mathExpression: string,options?: any): void;
};

declare const katex: Katex;