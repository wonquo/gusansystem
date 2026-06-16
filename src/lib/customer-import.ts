import type { CellValue, Worksheet } from "exceljs";

export type ImportedCustomer = {
  source: string | null;
  phone: string;
  gender: string | null;
  ageDecade: string | null;
  status: string | null;
  callNote: string | null;
  lastContactedAt: Date | null;
  lastContactedLabel: string | null;
  orderNote: string | null;
  remark: string | null;
  sourceRowNumber: number;
  rawData: Record<string, unknown>;
};

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

export function parseGenderAge(value: unknown) {
  const text = cleanText(value);
  if (!text) {
    return { gender: null, ageDecade: null };
  }

  const gender = text.includes("남") ? "남자" : text.includes("여") ? "여자" : null;
  const ageMatch = text.match(/(\d{1,2})\s*대/);

  return {
    gender,
    ageDecade: ageMatch ? `${ageMatch[1]}대` : null,
  };
}

export function parseContactDate(value: unknown, year = new Date().getFullYear()) {
  if (value == null || value === "") {
    return { date: null, label: null };
  }

  if (value instanceof Date) {
    return {
      date: value,
      label: formatKoreanMonthDay(value),
    };
  }

  if (typeof value === "number") {
    return {
      date: excelSerialDate(value),
      label: String(value),
    };
  }

  const label = cleanText(value);
  if (!label) {
    return { date: null, label: null };
  }

  if (/^\d+(\.\d+)?$/.test(label)) {
    const numeric = Number(label);
    if (numeric > 30000) {
      return { date: excelSerialDate(numeric), label };
    }

    const [month, day] = label.split(".");
    return { date: makeDate(year, Number(month), Number(day)), label };
  }

  const korean = label.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (korean) {
    return { date: makeDate(year, Number(korean[1]), Number(korean[2])), label };
  }

  return { date: null, label };
}

export function parseCustomerSheet(sheet: Worksheet, year = new Date().getFullYear()) {
  const imported: ImportedCustomer[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, sourceRowNumber) => {
    if (sourceRowNumber < 6) {
      return;
    }

    const source = getCellValue(row.getCell(1).value);
    const phone = getCellValue(row.getCell(2).value);
    const genderAge = getCellValue(row.getCell(3).value);
    const status = getCellValue(row.getCell(4).value);
    const callNote = getCellValue(row.getCell(5).value);
    const lastContacted = getCellValue(row.getCell(6).value);
    const orderNote = getCellValue(row.getCell(7).value);
    const remark = getCellValue(row.getCell(8).value);
    const normalizedPhone = cleanPhone(phone);

    if (!normalizedPhone || !PHONE_PATTERN.test(normalizedPhone)) {
      return;
    }

    const parsedGenderAge = parseGenderAge(genderAge);
    const parsedDate = parseContactDate(lastContacted, year);

    imported.push({
      source: cleanText(source),
      phone: normalizedPhone,
      gender: parsedGenderAge.gender,
      ageDecade: parsedGenderAge.ageDecade,
      status: cleanText(status),
      callNote: cleanText(callNote),
      lastContactedAt: parsedDate.date,
      lastContactedLabel: parsedDate.label,
      orderNote: cleanText(orderNote),
      remark: cleanText(remark),
      sourceRowNumber,
      rawData: {
        source,
        phone,
        genderAge,
        status,
        callNote,
        lastContacted,
        orderNote,
        remark,
      },
    });
  });

  return imported;
}

function getCellValue(value: CellValue): unknown {
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
  return text.length > 0 ? text : null;
}

function cleanPhone(value: unknown) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return text;
}

function excelSerialDate(serial: number) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 24 * 60 * 60 * 1000);
}

function makeDate(year: number, month: number, day: number) {
  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function formatKoreanMonthDay(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
