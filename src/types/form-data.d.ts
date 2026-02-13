declare module "form-data" {
  import { Readable } from "stream";

  class FormData {
    append(
      key: string,
      value: string | Buffer | Readable,
      options?: { filename?: string; contentType?: string }
    ): void;
    getHeaders(): { [key: string]: string };
    getBoundary(): string;
    getLength(callback: (err: Error | null, length: number) => void): void;
    getLengthSync(): number;
    getBuffer(): Buffer;
    pipe(writable: NodeJS.WritableStream): void;
  }

  export = FormData;
}
