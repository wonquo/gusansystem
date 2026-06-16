import ExcelJS, { type CellValue } from "exceljs";

export type ProjectImportItemType = "contract" | "payment" | "expense" | "memo";

export type ProjectImportItem = {
  itemType: ProjectImportItemType;
  sheetName: string;
  sourceRowNumber: number;
  sortOrder: number;
  orderedOn: string | null;
  partnerName: string | null;
  description: string | null;
  contractAmount: number;
  receivedAmount: number;
  spentAmount: number;
  memo: string | null;
  rawData: Record<string, unknown>;
};

export type ProjectImportProject = {
  sheetName: string;
  sourceStartRow: number;
  sourceEndRow: number;
  sourceTotalRow: number;
  orderedOn: string | null;
  projectName: string;
  clientName: string | null;
  contractAmount: number;
  receivedAmount: number;
  spentAmount: number;
  profitAmount: number;
  memo: string | null;
  rawData: Record<string, unknown>;
  items: ProjectImportItem[];
};

export type ProjectImportError = {
  sheetName: string;
  sourceRowNumber: number;
  message: string;
  rawData: Record<string, unknown>;
};

type ProjectRow = {
  sheetName: string;
  rowNumber: number;
  dateValue: unknown;
  partnerName: string | null;
  description: string | null;
  contractAmount: number;
  receivedAmount: number;
  spentAmount: number;
  profitAmount: number;
  memo: string | null;
  hasContractAmount: boolean;
  hasReceivedAmount: boolean;
  hasSpentAmount: boolean;
  hasProfitAmount: boolean;
  rawData: Record<string, unknown>;
};

type OpenProject = ProjectImportProject & {
  hasSummary: boolean;
};

const ADDENDUM_PATTERN = /추가(비용|공사|분)?/;

export async function parseProjectWorkbook(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const projects: ProjectImportProject[] = [];
  const errors: ProjectImportError[] = [];
  const sheets: string[] = [];

  for (const sheet of workbook.worksheets) {
    const headerRowNumber = findProjectHeaderRow(sheet);
    if (!headerRowNumber) {
      continue;
    }
    sheets.push(sheet.name);

    let current: OpenProject | null = null;

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = readProjectRow(sheet, rowNumber);
      if (isBlankProjectRow(row)) {
        continue;
      }

      if (isSummaryRow(row)) {
        if (!current) {
          continue;
        }
        applySummary(current, row);
        projects.push(closeProject(current));
        current = null;
        continue;
      }

      if (isProjectStartRow(row)) {
        if (current && shouldAttachAsContractAddendum(current, row)) {
          current.items.push(toProjectItem(row, "contract", current.items.length));
          current.sourceEndRow = row.rowNumber;
          current.rawData = {
            ...current.rawData,
            contractRows: [...getRawRows(current.rawData), row.rawData],
          };
          continue;
        }

        if (current) {
          applyComputedSummary(current);
          projects.push(closeProject(current));
        }
        current = createProject(row);
        continue;
      }

      if (!current) {
        continue;
      }

      const itemType = classifyDetailRow(row);
      if (itemType) {
        current.items.push(toProjectItem(row, itemType, current.items.length));
        current.sourceEndRow = row.rowNumber;
      }
    }

    if (current) {
      applyComputedSummary(current);
      projects.push(closeProject(current));
    }
  }

  if (!sheets.length) {
    errors.push({
      sheetName: "Workbook",
      sourceRowNumber: 0,
      message: "프로젝트 관리 헤더(일자/업체/PROJECT/수주금액)를 찾지 못했습니다.",
      rawData: {},
    });
  }

  return { detectedType: "projects", sheets, projects, errors };
}

function findProjectHeaderRow(sheet: ExcelJS.Worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
    const values = readRow(sheet.getRow(rowNumber).values as CellValue[]);
    const normalized = values.map((value) => normalizeKey(textValue(value) ?? ""));
    const hasDate = normalized.some((value) => value === "일자" || value.includes("날짜"));
    const hasPartner = normalized.some((value) => value === "업체" || value.includes("거래처"));
    const hasProject = normalized.some((value) => value.includes("project") || value.includes("프로젝트"));
    const hasContract = normalized.some((value) => value.includes("수주") || value.includes("계약"));
    if (hasDate && hasPartner && hasProject && hasContract) {
      return rowNumber;
    }
  }
  return 0;
}

function readProjectRow(sheet: ExcelJS.Worksheet, rowNumber: number): ProjectRow {
  const dateValue = resolvedCellValue(sheet, rowNumber, 1);
  const partnerName = textValue(resolvedCellValue(sheet, rowNumber, 2));
  const description = textValue(resolvedCellValue(sheet, rowNumber, 3));
  const contractRaw = resolvedCellValue(sheet, rowNumber, 4);
  const receivedRaw = resolvedCellValue(sheet, rowNumber, 5);
  const spentRaw = resolvedCellValue(sheet, rowNumber, 6);
  const memoRaw = resolvedCellValue(sheet, rowNumber, 7);
  const profitRaw = resolvedCellValue(sheet, rowNumber, 7);

  return {
    sheetName: sheet.name,
    rowNumber,
    dateValue,
    partnerName,
    description,
    contractAmount: numberValue(contractRaw),
    receivedAmount: numberValue(receivedRaw),
    spentAmount: numberValue(spentRaw),
    profitAmount: numberValue(profitRaw),
    memo: textValue(memoRaw),
    hasContractAmount: hasNumericValue(contractRaw),
    hasReceivedAmount: hasNumericValue(receivedRaw),
    hasSpentAmount: hasNumericValue(spentRaw),
    hasProfitAmount: hasNumericValue(profitRaw),
    rawData: {
      일자: textValue(dateValue),
      업체: partnerName,
      PROJECT: description,
      수주금액: textValue(contractRaw),
      결제금액: textValue(receivedRaw),
      집행금액: textValue(spentRaw),
      비고: textValue(memoRaw),
    },
  };
}

function isBlankProjectRow(row: ProjectRow) {
  if (row.hasContractAmount || row.hasReceivedAmount || row.hasSpentAmount || row.hasProfitAmount) {
    return false;
  }
  return ![
    row.dateValue,
    row.partnerName,
    row.description,
    row.contractAmount,
    row.receivedAmount,
    row.spentAmount,
    row.memo,
  ].some((value) => value != null && String(value).trim() !== "" && value !== 0);
}

function isSummaryRow(row: ProjectRow) {
  return row.hasContractAmount && row.hasReceivedAmount && row.hasSpentAmount && row.hasProfitAmount;
}

function isProjectStartRow(row: ProjectRow) {
  if (!row.dateValue || !row.partnerName || !row.description) {
    return false;
  }
  if (!dateValue(row.dateValue)) {
    return false;
  }
  if (row.hasReceivedAmount || row.hasSpentAmount) {
    return false;
  }
  return true;
}

function shouldAttachAsContractAddendum(current: OpenProject, row: ProjectRow) {
  if (!row.description || !ADDENDUM_PATTERN.test(row.description)) {
    return false;
  }
  return current.items.every((item) => item.itemType === "contract");
}

function classifyDetailRow(row: ProjectRow): ProjectImportItemType | null {
  if (row.hasContractAmount) {
    return "contract";
  }
  if (row.hasReceivedAmount) {
    return "payment";
  }
  if (row.hasSpentAmount) {
    return "expense";
  }
  if (row.description || row.memo) {
    return "memo";
  }
  return null;
}

function createProject(row: ProjectRow): OpenProject {
  const items: ProjectImportItem[] = [];
  if (row.hasContractAmount || row.memo) {
    items.push(toProjectItem(row, row.hasContractAmount ? "contract" : "memo", 0));
  }

  return {
    sheetName: row.sheetName,
    sourceStartRow: row.rowNumber,
    sourceEndRow: row.rowNumber,
    sourceTotalRow: row.rowNumber,
    orderedOn: dateValue(row.dateValue),
    projectName: row.description ?? "미지정 프로젝트",
    clientName: row.partnerName,
    contractAmount: row.contractAmount,
    receivedAmount: row.receivedAmount,
    spentAmount: row.spentAmount,
    profitAmount: row.contractAmount - row.spentAmount,
    memo: row.memo,
    rawData: {
      headerRow: row.rawData,
      contractRows: row.hasContractAmount || row.memo ? [row.rawData] : [],
      inferredTotal: true,
    },
    items,
    hasSummary: false,
  };
}

function applySummary(project: OpenProject, row: ProjectRow) {
  project.contractAmount = row.contractAmount;
  project.receivedAmount = row.receivedAmount;
  project.spentAmount = row.spentAmount;
  project.profitAmount = row.profitAmount;
  project.memo = [project.memo, textValue(row.dateValue)].filter(Boolean).join(" / ") || project.memo;
  project.sourceEndRow = row.rowNumber;
  project.sourceTotalRow = row.rowNumber;
  project.rawData = {
    ...project.rawData,
    summaryRow: row.rawData,
    inferredTotal: false,
  };
  project.hasSummary = true;
}

function applyComputedSummary(project: OpenProject) {
  project.contractAmount = sum(project.items, "contractAmount");
  project.receivedAmount = sum(project.items, "receivedAmount");
  project.spentAmount = sum(project.items, "spentAmount");
  project.profitAmount = project.receivedAmount - project.spentAmount;
  project.sourceTotalRow = project.sourceEndRow;
  project.rawData = {
    ...project.rawData,
    inferredTotal: true,
  };
}

function closeProject(project: OpenProject): ProjectImportProject {
  return {
    sheetName: project.sheetName,
    sourceStartRow: project.sourceStartRow,
    sourceEndRow: project.sourceEndRow,
    sourceTotalRow: project.sourceTotalRow,
    orderedOn: project.orderedOn,
    projectName: project.projectName,
    clientName: project.clientName,
    contractAmount: project.contractAmount,
    receivedAmount: project.receivedAmount,
    spentAmount: project.spentAmount,
    profitAmount: project.profitAmount,
    memo: project.memo,
    rawData: project.rawData,
    items: project.items,
  };
}

function toProjectItem(
  row: ProjectRow,
  itemType: ProjectImportItemType,
  sortOrder: number,
): ProjectImportItem {
  return {
    itemType,
    sheetName: row.sheetName,
    sourceRowNumber: row.rowNumber,
    sortOrder,
    orderedOn: dateValue(row.dateValue),
    partnerName: row.partnerName,
    description: row.description,
    contractAmount: row.contractAmount,
    receivedAmount: row.receivedAmount,
    spentAmount: row.spentAmount,
    memo: row.memo,
    rawData: row.rawData,
  };
}

function getRawRows(rawData: Record<string, unknown>) {
  const value = rawData.contractRows;
  return Array.isArray(value) ? value : [];
}

function sum(items: ProjectImportItem[], field: "contractAmount" | "receivedAmount" | "spentAmount") {
  return items.reduce((total, item) => total + item[field], 0);
}

function readRow(values: CellValue[]) {
  return values.slice(1).map((value) => cellValue(value));
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
  if ("formula" in value && value.formula != null) {
    return null;
  }
  if ("text" in value && value.text != null) {
    return value.text;
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((item) => item.text).join("");
  }
  return String(value);
}

function resolvedCellValue(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnNumber: number,
  visited = new Set<string>(),
): unknown {
  const key = `${sheet.name}:${rowNumber}:${columnNumber}`;
  if (visited.has(key)) {
    return null;
  }
  visited.add(key);

  const value = sheet.getRow(rowNumber).getCell(columnNumber).value;
  if (value && typeof value === "object" && !(value instanceof Date) && "formula" in value) {
    if ("result" in value && value.result != null) {
      return value.result;
    }
    return evaluateFormula(sheet, String(value.formula ?? ""), visited);
  }
  return cellValue(value);
}

function evaluateFormula(sheet: ExcelJS.Worksheet, formula: string, visited: Set<string>): number | null {
  const expression = formula.replace(/^=/, "").trim();
  const sumMatch = /^SUM\((.*)\)$/i.exec(expression);
  if (sumMatch) {
    return evaluateSumExpression(sheet, sumMatch[1], visited);
  }
  return evaluateArithmeticExpression(sheet, expression, visited);
}

function evaluateSumExpression(sheet: ExcelJS.Worksheet, expression: string, visited: Set<string>) {
  const rangeMatch = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(expression.trim());
  if (rangeMatch) {
    const startColumn = columnNumber(rangeMatch[1]);
    const startRow = Number(rangeMatch[2]);
    const endColumn = columnNumber(rangeMatch[3]);
    const endRow = Number(rangeMatch[4]);
    let total = 0;
    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        total += numberValue(resolvedCellValue(sheet, rowNumber, column, new Set(visited)));
      }
    }
    return total;
  }
  return evaluateArithmeticExpression(sheet, expression, visited);
}

function evaluateArithmeticExpression(sheet: ExcelJS.Worksheet, expression: string, visited: Set<string>) {
  const withValues = expression.replace(/\b([A-Z]+)(\d+)\b/gi, (_match, columnLetters, rowText) => {
    const value = resolvedCellValue(sheet, Number(rowText), columnNumber(columnLetters), new Set(visited));
    return String(numberValue(value));
  });
  if (!/^[\d+\-*/().\s]+$/.test(withValues)) {
    return null;
  }
  try {
    const result = Function(`"use strict"; return (${withValues});`)() as unknown;
    return typeof result === "number" && Number.isFinite(result) ? Math.round(result) : null;
  } catch {
    return null;
  }
}

function columnNumber(columnLetters: string) {
  return columnLetters
    .toUpperCase()
    .split("")
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function textValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return dateValue(value);
  }
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  const text = textValue(value);
  if (!text) {
    return 0;
  }
  const number = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function hasNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return true;
  }
  const text = textValue(value);
  if (!text) {
    return false;
  }
  return /^-?[\d,]+(\.\d+)?$/.test(text.replace(/\s/g, ""));
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  const text = textValue(value);
  if (text && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return null;
}
