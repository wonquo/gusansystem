declare module "xlsx-populate" {
  type WorkbookInput = string | Array<number> | ArrayBuffer | Uint8Array | Buffer | Blob | Promise<unknown>;

  type WorkbookOutputOptions = {
    type?: "base64" | "binarystring" | "uint8array" | "arraybuffer" | "blob" | "nodebuffer";
    password?: string;
  };

  interface Workbook {
    outputAsync(opts?: WorkbookOutputOptions | WorkbookOutputOptions["type"]): Promise<Buffer>;
  }

  interface XlsxPopulate {
    fromDataAsync(data: WorkbookInput, opts?: { password?: string }): Promise<Workbook>;
  }

  const xlsxPopulate: XlsxPopulate;
  export default xlsxPopulate;
}
