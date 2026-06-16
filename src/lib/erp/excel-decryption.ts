import XlsxPopulate from "xlsx-populate";

export class WorkbookDecryptionError extends Error {
  constructor(message = "엑셀 파일 비밀번호가 올바르지 않거나 지원하지 않는 암호화 형식입니다.") {
    super(message);
    this.name = "WorkbookDecryptionError";
  }
}

export async function decryptWorkbookBuffer(buffer: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  try {
    const workbook = await XlsxPopulate.fromDataAsync(Buffer.from(buffer), { password });
    const decrypted = await workbook.outputAsync({ type: "nodebuffer" });
    return bufferToArrayBuffer(decrypted);
  } catch {
    throw new WorkbookDecryptionError();
  }
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}
