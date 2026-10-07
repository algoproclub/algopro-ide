declare module 'showdown' {
  export type ConverterOptions = Record<string, unknown>;

  export class Converter {
    constructor(options?: ConverterOptions);
    makeHtml(markdown: string): string;
  }

  const showdown: {
    Converter: typeof Converter;
  };

  export default showdown;
}
