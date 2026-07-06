import ExcelJS, { type CellValue } from "exceljs";
import type { ProjectScheduleType } from "./data";

export type ProjectScheduleImportItem = {
  scheduleDate: string | null;
  scheduleText: string;
  taskDescription: string | null;
  managerName: string | null;
  status: string | null;
  memo: string | null;
  sourceLineNumber: number;
  sortOrder: number;
  rawData: Record<string, unknown>;
};

export type ProjectScheduleImportRow = {
  projectType: ProjectScheduleType;
  sheetName: string;
  sourceRowNumber: number;
  sourceSection: string | null;
  projectCode: string | null;
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
  items: ProjectScheduleImportItem[];
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
      rows.push(...parseMainSheet(sheet, headerRowNumber, headerMap));
    } else {
      rows.push(...parseSubSheet(sheet, headerRowNumber, headerMap));
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

  return { detectedType: "project-schedules", sheets, rows, errors };
}

function parseMainSheet(sheet: ExcelJS.Worksheet, headerRowNumber: number, headerMap: HeaderMap) {
  const rows: ProjectScheduleImportRow[] = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const raw = {
      No: readCellText(sheet, rowNumber, headerMap.no),
      PROJECT: readCellText(sheet, rowNumber, headerMap.project),
      업무내용: readCellText(sheet, rowNumber, headerMap.task),
      행선지: readCellText(sheet, rowNumber, headerMap.destination),
      제어부담당: readCellText(sheet, rowNumber, headerMap.controlManager),
      설비부담당: readCellText(sheet, rowNumber, headerMap.facilityManager),
      일정: readCellText(sheet, rowNumber, headerMap.schedule),
      비고: readCellText(sheet, rowNumber, headerMap.memo),
    };
    if (isBlankRawRow(raw) || isSkipProjectRow(raw.No, raw.PROJECT)) {
      continue;
    }

    const items = toScheduleItems({
      scheduleText: raw.일정,
      taskDescription: raw.업무내용,
      managerName: joinText(raw.제어부담당, raw.설비부담당),
      status: raw.비고,
      memo: null,
    });

    rows.push({
      projectType: "main",
      sheetName: sheet.name,
      sourceRowNumber: rowNumber,
      sourceSection: null,
      projectCode: raw.No,
      projectName: raw.PROJECT || "미지정 프로젝트",
      taskDescription: raw.업무내용,
      destinationName: raw.행선지,
      controlManagerName: raw.제어부담당,
      facilityManagerName: raw.설비부담당,
      managerName: joinText(raw.제어부담당, raw.설비부담당),
      projectMonth: null,
      status: raw.비고,
      expenseMemo: null,
      expenseAmount: 0,
      memo: raw.비고,
      rawData: raw,
      items,
    });
  }
  return rows;
}

function parseSubSheet(sheet: ExcelJS.Worksheet, headerRowNumber: number, headerMap: HeaderMap) {
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
      일정: readCellText(sheet, rowNumber, headerMap.schedule),
      비고: readCellText(sheet, rowNumber, headerMap.memo),
      집행금액자재: readCellText(sheet, rowNumber, headerMap.expense),
    };
    if (isBlankRawRow(raw) || isSkipProjectRow(raw.No, raw.PROJECT)) {
      continue;
    }
    if (!raw.PROJECT && !raw.업무내용 && !raw.일정) {
      continue;
    }

    const expenseAmount = numberFromText(raw.집행금액자재);
    const items = toScheduleItems({
      scheduleText: raw.일정,
      taskDescription: raw.업무내용,
      managerName: raw.담당자,
      status: raw.비고,
      memo: raw.집행금액자재,
    });

    rows.push({
      projectType: "sub",
      sheetName: sheet.name,
      sourceRowNumber: rowNumber,
      sourceSection,
      projectCode: raw.No,
      projectName: raw.PROJECT || "미지정 프로젝트",
      taskDescription: raw.업무내용,
      destinationName: null,
      controlManagerName: null,
      facilityManagerName: null,
      managerName: raw.담당자,
      projectMonth,
      status: raw.비고,
      expenseMemo: raw.집행금액자재,
      expenseAmount,
      memo: raw.비고,
      rawData: { ...raw, projectMonth, sourceSection },
      items,
    });
  }
  return rows;
}

function toScheduleItems({
  scheduleText,
  taskDescription,
  managerName,
  status,
  memo,
}: {
  scheduleText: string | null;
  taskDescription: string | null;
  managerName: string | null;
  status: string | null;
  memo: string | null;
}) {
  const lines = splitScheduleLines(scheduleText);
  if (!lines.length) {
    return [];
  }
  return lines.map((line, index) => ({
    scheduleDate: parseKoreanDate(line),
    scheduleText: line,
    taskDescription,
    managerName,
    status,
    memo,
    sourceLineNumber: index + 1,
    sortOrder: index,
    rawData: { scheduleText: line, originalScheduleText: scheduleText },
  }));
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
    const hasSchedule = values.includes("일정");
    const hasNo = values.includes("no");
    const hasTask = values.includes("업무내용");
    const hasExpectedMain = projectType === "main" && values.includes("행선지");
    const hasExpectedSub = projectType === "sub" && values.includes("담당자");
    if (hasNo && hasProject && hasTask && hasSchedule && (hasExpectedMain || hasExpectedSub)) {
      return rowNumber;
    }
  }
  return 0;
}

function readHeaderMap(sheet: ExcelJS.Worksheet, rowNumber: number): HeaderMap {
  const map: HeaderMap = {};
  for (let columnNumber = 1; columnNumber <= sheet.columnCount; columnNumber += 1) {
    const key = normalizeHeader(readCellText(sheet, rowNumber, columnNumber));
    if (key === "no") map.no = columnNumber;
    if (key === "project" || key === "프로젝트") map.project = columnNumber;
    if (key === "업무내용") map.task = columnNumber;
    if (key === "행선지") map.destination = columnNumber;
    if (key === "제어부담당") map.controlManager = columnNumber;
    if (key === "설비부담당") map.facilityManager = columnNumber;
    if (key === "담당자") map.manager = columnNumber;
    if (key === "일정") map.schedule = columnNumber;
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

function splitScheduleLines(value: string | null) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isBlankRawRow(raw: Record<string, string | null>) {
  return Object.values(raw).every((value) => !String(value ?? "").trim());
}

function isSkipProjectRow(projectCode: string | null, projectName: string | null) {
  return [projectCode, projectName].some((value) => value && SKIP_ROW_TEXTS.has(value.trim()));
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

function parseKoreanDate(value: string) {
  const text = value.trim();
  const full = text.match(/(\d{2,4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (full) {
    const year = normalizeYear(full[1]);
    return `${year}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  }
  return null;
}

function normalizeYear(value: string) {
  const year = Number(value);
  return String(year < 100 ? 2000 + year : year);
}
