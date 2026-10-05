/**
 * De worker van pdfjs heeft geen eigen typen. `lib/pdf-tekst.ts` laadt hem
 * alleen om hem aan `globalThis.pdfjsWorker` te hangen, zodat pdfjs in de
 * hoofddraad draait; wat erin zit doet er voor ons niet toe.
 */
declare module "pdfjs-dist/build/pdf.worker.min.mjs";
