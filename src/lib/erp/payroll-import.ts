import ExcelJS, { type CellValue, type Worksheet } from "exceljs";

export type ParsedPayrollItem = {
  itemType: "earning" | "deduction" | "summary";
  label: string;
  amount: number;
  sortOrder: number;
  rawData: unknown;
};

export type ParsedPayrollSlip = {
  employeeCode: string | null;
  employeeName: string;
  position: string | null;
  payrollMonth: string;
  payrollBankAccount: string | null;
  grossPay: number;
  totalDeduction: number;
  netPay: number;
  sourceSheetName: string;
  sourceBlock: string;
  rawData: Record<string, unknown>;
  items: ParsedPayrollItem[];
};

export type PayrollParseResult = {
  detectedType: "payroll-slips";
  sheets: string[];
  slips: ParsedPayrollSlip[];
  errors: { sheetName: string; sourceRowNumber: number; message: string; rawData: unknown }[];
};

const BLOCK_LABEL_COLUMNS = [1, 4, 7, 10];
const DEDUCTION_START_LABEL = "공제항목";
const SUMMARY_LABELS = new Set(["지급액계", "공제액계", "지급 총액", "지급총액"]);

export async function parsePayrollWorkbook(buffer: ArrayBuffer): Promise<PayrollParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const payrollSheets = workbook.worksheets.filter((sheet) => /급여명세서/.test(sheet.name));
  const slips: ParsedPayrollSlip[] = [];
  const errors: PayrollParseResult["errors"] = [];

  for (const sheet of payrollSheets) {
    for (const labelColumn of BLOCK_LABEL_COLUMNS) {
      const valueColumn = labelColumn + 1;
      const title = cleanText(cellValue(sheet.getCell(1, labelColumn).value));
      const personLine = cleanText(cellValue(sheet.getCell(3, labelColumn).value));
      if (!title || !personLine?.includes("성명")) {
        continue;
      }

      try {
        const slip = parsePayrollBlock(sheet, labelColumn, valueColumn);
        if (slip) {
          slips.push(slip);
        }
      } catch (error) {
        errors.push({
          sheetName: sheet.name,
          sourceRowNumber: 1,
          message: error instanceof Error ? error.message : "급여 블록을 파싱하지 못했습니다.",
          rawData: readBlockRawData(sheet, labelColumn, valueColumn),
        });
      }
    }
  }

  if (!payrollSheets.length) {
    errors.push({
      sheetName: "Workbook",
      sourceRowNumber: 0,
      message: "급여명세서 시트를 찾지 못했습니다.",
      rawData: { sheetNames: workbook.worksheets.map((sheet) => sheet.name) },
    });
  }

  return {
    detectedType: "payroll-slips",
    sheets: payrollSheets.map((sheet) => sheet.name),
    slips,
    errors,
  };
}

function parsePayrollBlock(sheet: Worksheet, labelColumn: number, valueColumn: number) {
  const title = cleanText(cellValue(sheet.getCell(1, labelColumn).value));
  const employeeCodeLine = cleanText(cellValue(sheet.getCell(2, labelColumn).value));
  const personLine = cleanText(cellValue(sheet.getCell(3, labelColumn).value));
  const accountLine = cleanText(cellValue(sheet.getCell(4, labelColumn).value));
  const payrollMonth = parsePayrollMonth(title, sheet.name);
  const { employeeName, position } = parsePersonLine(personLine);

  if (!employeeName) {
    return null;
  }

  const employeeCode = employeeCodeLine?.match(/사원코드\s*:\s*([A-Z0-9-]+)/i)?.[1] ?? null;
  const payrollBankAccount = accountLine?.replace(/^급여통장\s*:\s*/, "").trim() || null;
  const items: ParsedPayrollItem[] = [];
  let currentType: ParsedPayrollItem["itemType"] = "earning";

  for (let row = 5; row <= Math.min(sheet.rowCount, 32); row += 1) {
    const label = cleanText(cellValue(sheet.getCell(row, labelColumn).value));
    if (!label) {
      continue;
    }
    if (label.includes("거산시스템")) {
      break;
    }
    if (label === DEDUCTION_START_LABEL) {
      currentType = "deduction";
      continue;
    }

    const amount = numberValue(cellValue(sheet.getCell(row, valueColumn).value));
    const itemType = SUMMARY_LABELS.has(label) ? "summary" : currentType;
    items.push({
      itemType,
      label,
      amount,
      sortOrder: row,
      rawData: {
        labelCell: sheet.getCell(row, labelColumn).address,
        valueCell: sheet.getCell(row, valueColumn).address,
        value: cellValue(sheet.getCell(row, valueColumn).value),
      },
    });
  }

  const grossPay = findAmount(items, "지급액계");
  const totalDeduction = findAmount(items, "공제액계");
  const netPay = findAmount(items, "지급 총액") || findAmount(items, "지급총액");

  return {
    employeeCode,
    employeeName,
    position,
    payrollMonth,
    payrollBankAccount,
    grossPay,
    totalDeduction,
    netPay,
    sourceSheetName: sheet.name,
    sourceBlock: `${sheet.getCell(1, labelColumn).address}:${sheet.getCell(21, valueColumn).address}`,
    rawData: {
      title,
      employeeCodeLine,
      personLine,
      accountLine,
      items,
    },
    items,
  };
}

function parsePayrollMonth(title: string | null, fallback: string) {
  const text = title || fallback;
  const match = text.match(/(20)?(\d{2})년\s*(\d{1,2})월/);
  if (match) {
    const year = match[1] ? `${match[1]}${match[2]}` : `20${match[2]}`;
    return `${year}-${match[3].padStart(2, "0")}`;
  }
  const sheetMatch = fallback.match(/(\d{1,2})월/);
  return sheetMatch ? `2023-${sheetMatch[1].padStart(2, "0")}` : fallback;
}

function parsePersonLine(value: string | null) {
  if (!value) {
    return { employeeName: null, position: null };
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  const nameMatch = normalized.match(/성명\s*:\s*([^\s]+(?:\s+[^\s]+)*)\s+직책\s*:/);
  const positionMatch = normalized.match(/직책\s*:\s*(.+)$/);
  return {
    employeeName: nameMatch?.[1]?.trim() ?? null,
    position: positionMatch?.[1]?.trim() ?? null,
  };
}

function findAmount(items: ParsedPayrollItem[], label: string) {
  return items.find((item) => item.label === label)?.amount ?? 0;
}

function readBlockRawData(sheet: Worksheet, labelColumn: number, valueColumn: number) {
  const rows: Record<string, unknown>[] = [];
  for (let row = 1; row <= Math.min(sheet.rowCount, 32); row += 1) {
    rows.push({
      row,
      labelCell: sheet.getCell(row, labelColumn).address,
      label: cellValue(sheet.getCell(row, labelColumn).value),
      valueCell: sheet.getCell(row, valueColumn).address,
      value: cellValue(sheet.getCell(row, valueColumn).value),
    });
  }
  return rows;
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

function cleanText(value: unknown) {
  if (value == null) {
    return null;
  }
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  const text = cleanText(value);
  if (!text) {
    return 0;
  }
  const number = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

