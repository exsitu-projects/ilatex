// Since there are no good types available for pdf.js library yet,
// the types of the objects provided by the library must either be
// overly generic or defined below before they are used
export type PDFDocument = any;
export type PDFPage = any;
export type PDFPageViewmport = any;
export type PDFRenderTask = any;
export type PDFAnnotation = any;
export type PDFRect = [number, number, number, number];

// Get a reference to the pdf.js library
export const lib: any = (window as any)["pdfjsLib"];

// Set up the worker URI (required by the lib)
// TODO: switch to a local URI (it requires to use a special URI computed by VSCode)
lib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
