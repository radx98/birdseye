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

declare module "parquet-wasm/bundler" {
  export type ParquetTable = {
    intoIPCStream(): Uint8Array;
    free?(): void;
  };

  export function readParquet(
    source: Buffer | Uint8Array | ArrayBuffer,
  ): ParquetTable;
}

declare module "apache-arrow" {
  export type ArrowField = {
    name: string;
  };

  export type ArrowSchema = {
    fields: ArrowField[];
  };

  export interface ArrowRow {
    [key: string]: unknown;
  }

  export interface ArrowTable extends Iterable<ArrowRow> {
    numRows: number;
    schema: ArrowSchema;
    get(index: number): ArrowRow;
  }

  export function tableFromIPC(
    source: Buffer | Uint8Array | ArrayBuffer,
  ): ArrowTable;
}
