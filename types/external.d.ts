declare module "pickleparser" {
  export class BufferReader {
    uint64(): number | bigint;
    skip(offset: number): void;
  }

  export class Parser {
    constructor();
    parse<T>(buffer: Buffer | Uint8Array): T;
  }
}
