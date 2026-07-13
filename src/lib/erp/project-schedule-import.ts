import ExcelJS, { type CellValue } from "exceljs";
import type { ProjectScheduleType } from "./data";

export type ProjectScheduleImportRow = {
  projectType: ProjectScheduleType;
  sheetName: string;
  sourceRowNumber: number;
  sourceSection: string | null;
  projectCode: string | null;
  projectCodeGenerated?: boolean;
  projectName: string;
  taskDescription: string | null;
  destinationName: string | null;
  controlManagerName: string | null;
  facilityManagerName: string | null;
  managerName: string | null;
  projectMonth: string | null;
  status: string | null;
  expenseMemo: string | null;
  expenseAmount: number;
  memo: string | null;
  rawData: Record<string, unknown>;
};

export type ProjectScheduleImportError = {
  sheetName: string;
  sourceRowNumber: number;
  message: string;
  rawData: Record<string, unknown>;
};

type HeaderMap = Record<string, number>;

const MAIN_SHEET_KEYWORDS = ["main project", "main"];
const SUB_SHEET_KEYWORDS = ["sub project", "sub"];
const SKIP_ROW_TEXTS = new Set(["준비 PROJECT"]);

export async function parseProjectScheduleWorkbook(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const rows: ProjectScheduleImportRow[] = [];
  const errors: ProjectScheduleImportError[] = [];
  const sheets: string[] = [];

  for (const sheet of workbook.worksheets) {
    const projectType = detectProjectScheduleType(sheet.name);
    if (!projectType) {
      continue;
    }

    const headerRowNumber = findHeaderRow(sheet, projectType);
    if (!headerRowNumber) {
      errors.push({
        sheetName: sheet.name,
        sourceRowNumber: 0,
        message: `${sheet.name} 시트에서 프로젝트 헤더를 찾지 못했습니다.`,
        rawData: {},
      });
      continue;
    }

    sheets.push(sheet.name);
    const headerMap = readHeaderMap(sheet, headerRowNumber);
    if (projectType === "main") {
      rows.push(...parseMainSheet(sheet, headerRowNumber, headerMap, errors));
    } else {
      rows.push(...parseSubSheet(sheet, headerRowNumber, headerMap, errors));
    }
  }

  if (!sheets.length) {
    errors.push({
      sheetName: "Workbook",
      sourceRowNumber: 0,
      message: "MAIN PROJECT 또는 SUB PROJECT 시트를 찾지 못했습니다.",
      rawData: {},
    });
  }
  validateDuplicateProjectCodes(rows, errors);
  if (sheets.length && !rows.length && !errors.length) {
    errors.push({
      sheetName: sheets[0],
      sourceRowNumber: 0,
      message: "업로드할 프로젝트 데이터가 없습니다.",
      rawData: {},
    });
  }

  return { detectedType: "project-schedules", sheets, rows, errors };
}

function parseMainSheet(
  sheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  headerMap: HeaderMap,
  errors: ProjectScheduleImportError[],
) {
  const rows: ProjectScheduleImportRow[] = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const raw = {
      No: readCellText(sheet, rowNumber, headerMap.no),
      PROJECT: readCellText(sheet, rowNumber, headerMap.project),
      업무내용: readCellText(sheet, rowNumber, headerMap.task),
      설치장소: readCellText(sheet, rowNumber, headerMap.destination),
      제어부담당: readCellText(sheet, rowNumber, headerMap.controlManager),
      설비부담당: readCellText(sheet, rowNumber, headerMap.facilityManager),
      상태: readCellText(sheet, rowNumber, headerMap.status),
      비고: readCellText(sheet, rowNumber, headerMap.memo),
    };
    if (isBlankRawRow(raw) || isSkipProjectRow(raw.No, raw.PROJECT)) {
      continue;
    }
    if (!raw.PROJECT) {
      errors.push({
        sheetName: sheet.name,
        sourceRowNumber: rowNumber,
        message: `${sheet.name} ${rowNumber}행: 프로젝트명을 입력해 주세요.`,
        rawData: raw,
      });
      continue;
    }

    rows.push({
      projectType: "main",
      sheetName: sheet.name,
      sourceRowNumber: rowNumber,
      sourceSection: null,
      projectCode: raw.No,
      projectName: raw.PROJECT,
      taskDescription: raw.업무내용,
      destinationName: raw.설치장소,
      controlManagerName: raw.제어부담당,
      facilityManagerName: raw.설비부담당,
      managerName: joinText(raw.제어부담당, raw.설비부담당),
      projectMonth: null,
      status: raw.상태 || raw.비고,
      expenseMemo: null,
      expenseAmount: 0,
      memo: raw.비고,
      rawData: raw,
    });
  }
  return rows;
}

function parseSubSheet(
  sheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  headerMap: HeaderMap,
  errors: ProjectScheduleImportError[],
) {
  const rows: ProjectScheduleImportRow[] = [];
  let projectMonth: string | null = null;
  let sourceSection: string | null = null;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const rowValues = readRowTexts(sheet, rowNumber, sheet.columnCount);
    const compactValues = rowValues.filter(Boolean);
    if (!compactValues.length) {
      continue;
    }

    const firstLabel = compactValues[0] ?? "";
    if (isMonthLabel(firstLabel)) {
      projectMonth = firstLabel;
      sourceSection = firstLabel;
      continue;
    }
    if (firstLabel === "진행예상 PROJECT" || firstLabel === "MAIN PROJECT") {
      sourceSection = firstLabel;
      continue;
    }

    const raw = {
      No: readCellText(sheet, rowNumber, headerMap.no),
      PROJECT: readCellText(sheet, rowNumber, headerMap.project),
      업무내용: readCellText(sheet, rowNumber, headerMap.task),
      담당자: readCellText(sheet, rowNumber, headerMap.manager),
      행선지: readCellText(sheet, rowNumber, headerMap.destination),
      상태: readCellText(sheet, rowNumber, headerMap.status),
      비고: readCellText(sheet, rowNumber, headerMap.memo),
      집행금액자재: readCellText(sheet, rowNumber, headerMap.expense),
    };
    if (isBlankRawRow(raw) || isSkipProjectRow(raw.No, raw.PROJECT)) {
      continue;
    }
    if (!raw.PROJECT) {
      errors.push({
        sheetName: sheet.name,
        sourceRowNumber: rowNumber,
        message: `${sheet.name} ${rowNumber}행: 프로젝트명을 입력해 주세요.`,
        rawData: raw,
      });
      continue;
    }

    const expenseAmount = numberFromText(raw.집행금액자재);
    rows.push({
      projectType: "sub",
      sheetName: sheet.name,
      sourceRowNumber: rowNumber,
      sourceSection,
      projectCode: raw.No,
      projectName: raw.PROJECT,
      taskDescription: raw.업무내용,
      destinationName: null,
      controlManagerName: null,
      facilityManagerName: null,
      managerName: raw.담당자,
      projectMonth: raw.행선지 || projectMonth,
      status: raw.상태 || raw.비고,
      expenseMemo: raw.집행금액자재,
      expenseAmount,
      memo: raw.비고,
      rawData: { ...raw, projectMonth: raw.행선지 || projectMonth, sourceSection },
    });
  }
  return rows;
}

function detectProjectScheduleType(sheetName: string): ProjectScheduleType | null {
  const normalized = sheetName.trim().toLowerCase();
  if (MAIN_SHEET_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "main";
  }
  if (SUB_SHEET_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "sub";
  }
  return null;
}

function findHeaderRow(sheet: ExcelJS.Worksheet, projectType: ProjectScheduleType) {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 15); rowNumber += 1) {
    const values = readRowTexts(sheet, rowNumber, sheet.columnCount).map(normalizeHeader);
    const hasProject = values.includes("project") || values.includes("프로젝트");
    const hasNo = values.some((value) => ["no", "프로젝트코드", "관리번호"].includes(value));
    const hasTask = values.includes("업무내용");
    const hasExpectedMain =
      projectType === "main" && (values.includes("설치장소") || values.includes("행선지"));
    const hasExpectedSub = projectType === "sub" && values.includes("담당자");
    if (hasNo && hasProject && hasTask && (hasExpectedMain || hasExpectedSub)) {
      return rowNumber;
    }
  }
  return 0;
}

function readHeaderMap(sheet: ExcelJS.Worksheet, rowNumber: number): HeaderMap {
  const map: HeaderMap = {};
  for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
    const key = normalizeHeader(readCellText(sheet, rowNumber, columnNumber));
    if (["no", "프로젝트코드", "관리번호"].includes(key)) map.no = columnNumber;
    if (key === "project" || key === "프로젝트") map.project = columnNumber;
    if (key === "업무내용") map.task = columnNumber;
    if (key === "행선지" || key === "설치장소") map.destination = columnNumber;
    if (key === "제어부담당") map.controlManager = columnNumber;
    if (key === "설비부담당") map.facilityManager = columnNumber;
    if (key === "담당자") map.manager = columnNumber;
    if (key === "상태") map.status = columnNumber;
    if (key === "비고") map.memo = columnNumber;
    if (key.includes("집행금액")) map.expense = columnNumber;
  }
  return map;
}

function readRowTexts(sheet: ExcelJS.Worksheet, rowNumber: number, columnCount: number) {
  const values: string[] = [];
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    values.push(readCellText(sheet, rowNumber, columnNumber) ?? "");
  }
  return values;
}

function readCellText(sheet: ExcelJS.Worksheet, rowNumber: number, columnNumber?: number) {
  if (!columnNumber) {
    return null;
  }
  return textValue(sheet.getRow(rowNumber).getCell(columnNumber).value);
}

function textValue(value: CellValue | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return cleanText(value.richText.map((part) => part.text).join(""));
    }
    if ("text" in value && typeof value.text === "string") {
      return cleanText(value.text);
    }
    if ("result" in value) {
      return textValue(value.result as CellValue);
    }
    return cleanText(String(value));
  }
  return cleanText(String(value));
}

function cleanText(value: string) {
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return text || null;
}

function normalizeHeader(value: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[().]/g, "")
    .toLowerCase();
}

function isBlankRawRow(raw: Record<string, string | null>) {
  return Object.values(raw).every((value) => !String(value ?? "").trim());
}

function isSkipProjectRow(projectCode: string | null, projectName: string | null) {
  return [projectCode, projectName].some((value) => value && SKIP_ROW_TEXTS.has(value.trim()));
}

function validateDuplicateProjectCodes(
  rows: ProjectScheduleImportRow[],
  errors: ProjectScheduleImportError[],
) {
  const firstRowByCode = new Map<string, ProjectScheduleImportRow>();
  rows.forEach((row) => {
    const code = row.projectCode?.trim();
    if (!code) return;
    const key = code.toLowerCase();
    const firstRow = firstRowByCode.get(key);
    if (!firstRow) {
      firstRowByCode.set(key, row);
      return;
    }
    errors.push({
      sheetName: row.sheetName,
      sourceRowNumber: row.sourceRowNumber,
      message: `${row.sheetName} ${row.sourceRowNumber}행: 프로젝트코드 '${code}'가 ${firstRow.sheetName} ${firstRow.sourceRowNumber}행과 중복됩니다.`,
      rawData: row.rawData,
    });
  });
}

function isMonthLabel(value: string) {
  return /^\d{2}년\s*\d{1,2}월$/.test(value.trim());
}

function joinText(...values: (string | null)[]) {
  const text = values.filter(Boolean).join("\n").trim();
  return text || null;
}

function numberFromText(value: string | null) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0]) * (String(value).includes("만원") ? 10000 : 1)) : 0;
}
