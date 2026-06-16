import ExcelJS, { type CellValue } from "exceljs";

export type GenericImportRow = {
  sheetName: string;
  sourceRowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
};

export async function parseGenericWorkbook(buffer: ArrayBuffer, type: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { sheetName: "Workbook", rows: [], errors: ["시트를 찾지 못했습니다."] };
  }

  const headerRowNumber = findHeaderRow(sheet);
  if (!headerRowNumber) {
    return { sheetName: sheet.name, rows: [], errors: ["헤더 행을 찾지 못했습니다."] };
  }

  const headers = readRow(sheet.getRow(headerRowNumber).values as CellValue[]);
  const rows: GenericImportRow[] = [];

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const rowValues = readRow(sheet.getRow(rowNumber).values as CellValue[]);
    if (!rowValues.some((value) => value != null && String(value).trim() !== "")) {
      continue;
    }
    const rawData = Object.fromEntries(
      headers.map((header, index) => [header || `column_${index + 1}`, rowValues[index] ?? null]),
    );
    rows.push({
      sheetName: sheet.name,
      sourceRowNumber: rowNumber,
      rawData,
      normalizedData: normalizeRow(type, rawData),
    });
  }

  return { sheetName: sheet.name, rows, errors: [] };
}

function findHeaderRow(sheet: ExcelJS.Worksheet) {
  let bestRow = 0;
  let bestScore = 0;
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
    const values = readRow(sheet.getRow(rowNumber).values as CellValue[]);
    const score = values.filter((value) => value != null && String(value).trim() !== "").length;
    if (score > bestScore) {
      bestRow = rowNumber;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? bestRow : 0;
}

function readRow(values: CellValue[]) {
  return values.slice(1).map((value) => cellValue(value));
}

function normalizeRow(type: string, rawData: Record<string, unknown>) {
  const entries = Object.entries(rawData);
  const pick = (...patterns: RegExp[]) =>
    entries.find(([key]) => patterns.some((pattern) => pattern.test(normalizeKey(key))))?.[1] ?? null;

  if (type === "projects") {
    return {
      projectCode: pick(/코드|번호|no/),
      projectName: pick(/프로젝트|project|공사|현장|품명|내역|명칭/),
      clientName: pick(/거래처|고객|발주|업체|상호/),
      managerName: pick(/담당|관리자/),
      status: pick(/상태|진행|구분/),
      contractAmount: pick(/계약|금액|합계|공급가/),
      receivedAmount: pick(/입금|수금|회수/),
      memo: pick(/메모|비고|내용/),
    };
  }

  if (type === "tax-invoices") {
    return {
      issuedOn: pick(/일자|발행|작성|날짜/),
      direction: pick(/구분|매출|매입/),
      partnerName: pick(/거래처|상호|업체|공급받는|공급자/),
      projectName: pick(/프로젝트|공사|현장/),
      itemName: pick(/품목|내역|적요/),
      supplyAmount: pick(/공급가|공급.*액/),
      taxAmount: pick(/세액|부가세/),
      totalAmount: pick(/합계|총액|금액/),
      status: pick(/상태|구분/),
      memo: pick(/메모|비고/),
    };
  }

  return {
    transactedOn: pick(/일자|거래일|날짜/),
    bankName: pick(/은행|금융/),
    accountNumber: pick(/계좌/),
    description: pick(/내용|적요|거래처|기재/),
    depositAmount: pick(/입금|맡기신|수입/),
    withdrawalAmount: pick(/출금|찾으신|지출/),
    balanceAmount: pick(/잔액|누계/),
    category: pick(/분류|계정|구분/),
    memo: pick(/메모|비고/),
  };
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function cellValue(value: CellValue): unknown {
  if (value == null) {
    return null;
  }
  if (value instanceof Date || typeof value !== "object") {
    return value;
  }
  if ("result" in value && value.result != null) {
    return value.result;
  }
  if ("text" in value && value.text != null) {
    return value.text;
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text).join("");
  }
  return String(value);
}

