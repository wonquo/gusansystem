import { and, asc, count, eq, gte, lt, sql } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import {
  appUsers,
  workDiaryDestinations,
  workDiaryEntries,
  workDiaryTypes,
  type AppUserRole,
} from "@/db/schema";
import type { WorkDiaryDestinationRow, WorkDiaryRow, WorkDiaryTypeRow } from "./types";

export type WorkDiaryEntryInput = {
  id?: string;
  userId?: string | null;
  workDate?: string;
  workType?: string | null;
  workTypeId?: string | null;
  primaryWork?: string | null;
  secondaryWork?: string | null;
  destinationId?: string | null;
  memo?: string | null;
  sortOrder?: number | null;
};

export type WorkDiaryBulkInput = {
  created?: WorkDiaryEntryInput[];
  updated?: WorkDiaryEntryInput[];
  deleted?: string[];
};

const WORK_DIARY_TYPE_CODE_PREFIX = "TYPE";
const WORK_DIARY_TYPE_CODE_PAD_LENGTH = 3;
const WORK_DIARY_TYPE_CODE_INSERT_ATTEMPTS = 20;
const WORK_DIARY_DESTINATION_CODE_PREFIX = "DEST";
const WORK_DIARY_DESTINATION_CODE_PAD_LENGTH = 3;
const WORK_DIARY_DESTINATION_CODE_INSERT_ATTEMPTS = 20;

export function currentMonthText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function normalizeWorkDiaryMonth(value: string | null | undefined) {
  const month = value?.trim() || currentMonthText();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("조회 월은 YYYY-MM 형식이어야 합니다.");
  }
  return month;
}

export async function listWorkDiaryDestinations(): Promise<WorkDiaryDestinationRow[]> {
  if (!hasDatabaseUrl()) {
    const now = new Date().toISOString();
    return [
      {
        id: "demo-office",
        code: "OFFICE",
        label: "사무실",
        sortOrder: 0,
        isActive: true,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  const usageRows = await getDb()
    .select({
      destinationId: workDiaryEntries.destinationId,
      usageCount: count(),
    })
    .from(workDiaryEntries)
    .where(sql`${workDiaryEntries.destinationId} is not null`)
    .groupBy(workDiaryEntries.destinationId);
  const usageById = new Map(usageRows.map((row) => [row.destinationId, row.usageCount]));

  const rows = await getDb().query.workDiaryDestinations.findMany({
    orderBy: [asc(workDiaryDestinations.sortOrder), asc(workDiaryDestinations.label)],
  });

  return rows.map((row) => ({
    ...row,
    usageCount: usageById.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listWorkDiaryTypes(): Promise<WorkDiaryTypeRow[]> {
  if (!hasDatabaseUrl()) {
    const now = new Date().toISOString();
    return [
      { id: "demo-trip", code: "TRIP", label: "출장", color: "#2563eb", sortOrder: 0, isActive: true, usageCount: 0, createdAt: now, updatedAt: now },
      { id: "demo-work", code: "WORK", label: "업무", color: "#475569", sortOrder: 1, isActive: true, usageCount: 0, createdAt: now, updatedAt: now },
      { id: "demo-vacation", code: "VACATION", label: "휴가", color: "#dc2626", sortOrder: 2, isActive: true, usageCount: 0, createdAt: now, updatedAt: now },
      { id: "demo-am-vacation", code: "AM_VACATION", label: "오전휴가", color: "#9333ea", sortOrder: 3, isActive: true, usageCount: 0, createdAt: now, updatedAt: now },
      { id: "demo-pm-vacation", code: "PM_VACATION", label: "오후휴가", color: "#be123c", sortOrder: 4, isActive: true, usageCount: 0, createdAt: now, updatedAt: now },
    ];
  }

  const usageRows = await getDb()
    .select({
      workTypeId: workDiaryEntries.workTypeId,
      usageCount: count(),
    })
    .from(workDiaryEntries)
    .where(sql`${workDiaryEntries.workTypeId} is not null`)
    .groupBy(workDiaryEntries.workTypeId);
  const usageById = new Map(usageRows.map((row) => [row.workTypeId, row.usageCount]));

  const rows = await getDb().query.workDiaryTypes.findMany({
    orderBy: [asc(workDiaryTypes.sortOrder), asc(workDiaryTypes.label)],
  });

  return rows.map((row) => serializeWorkType(row, usageById.get(row.id) ?? 0));
}

export async function listWorkDiaryRows({
  currentUserId,
  currentUserName,
  role,
  month,
  targetUserId,
}: {
  currentUserId: string;
  currentUserName: string;
  role: AppUserRole;
  month: string;
  targetUserId?: string | null;
}): Promise<WorkDiaryRow[]> {
  const normalizedMonth = normalizeWorkDiaryMonth(month);
  const ownerId = role === "admin" && targetUserId ? targetUserId : currentUserId;

  if (!hasDatabaseUrl()) {
    return buildPlaceholderRows(normalizedMonth, ownerId, currentUserName);
  }

  const owner = await getDb().query.appUsers.findFirst({
    where: eq(appUsers.id, ownerId),
  });
  if (!owner) {
    throw new Error("업무일지 대상 사용자를 찾지 못했습니다.");
  }

  const [startDate, nextMonthDate] = getMonthBounds(normalizedMonth);
  const rows = await getDb()
    .select({
      entry: workDiaryEntries,
      userName: appUsers.name,
      workTypeCode: workDiaryTypes.code,
      workTypeLabel: workDiaryTypes.label,
      workTypeColor: workDiaryTypes.color,
      destinationCode: workDiaryDestinations.code,
      destinationLabel: workDiaryDestinations.label,
    })
    .from(workDiaryEntries)
    .innerJoin(appUsers, eq(workDiaryEntries.userId, appUsers.id))
    .leftJoin(workDiaryTypes, eq(workDiaryEntries.workTypeId, workDiaryTypes.id))
    .leftJoin(workDiaryDestinations, eq(workDiaryEntries.destinationId, workDiaryDestinations.id))
    .where(
      and(
        eq(workDiaryEntries.userId, owner.id),
        gte(workDiaryEntries.workDate, startDate),
        lt(workDiaryEntries.workDate, nextMonthDate),
      ),
    )
    .orderBy(asc(workDiaryEntries.workDate), asc(workDiaryEntries.sortOrder), asc(workDiaryEntries.createdAt));

  const serialized = rows.map(({ entry, userName, workTypeCode, workTypeLabel, workTypeColor, destinationCode, destinationLabel }) => ({
    id: entry.id,
    userId: entry.userId,
    userName,
    workDate: entry.workDate,
    workType: normalizeText(entry.workType) || "업무",
    workTypeId: entry.workTypeId,
    workTypeCode,
    workTypeLabel: (workTypeLabel ?? normalizeText(entry.workType)) || null,
    workTypeColor,
    primaryWork: entry.primaryWork,
    secondaryWork: entry.secondaryWork,
    destinationId: entry.destinationId,
    destinationCode,
    destinationLabel,
    memo: entry.memo,
    sortOrder: entry.sortOrder,
    isPlaceholder: false,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return mergeMonthlyPlaceholders(normalizedMonth, owner.id, owner.name, dedupeWorkDiaryRowsByDate(serialized));
}

export async function saveWorkDiaryBulk({
  currentUserId,
  role,
  input,
}: {
  currentUserId: string;
  role: AppUserRole;
  input: WorkDiaryBulkInput;
}) {
  if (!hasDatabaseUrl()) {
    return { ok: true };
  }

  const db = getDb();
  const now = new Date();
  const created = input.created ?? [];
  const updated = input.updated ?? [];
  const deleted = input.deleted ?? [];
  const defaultWorkType = await resolveDefaultWorkType();

  for (const row of created) {
    const workDate = normalizeWorkDate(row.workDate);
    const userId = role === "admin" && row.userId ? row.userId : currentUserId;
    const selectedWorkType = role === "admin" ? await resolveWorkType(row.workTypeId, defaultWorkType) : defaultWorkType;
    const values = {
      userId,
      workDate,
      workType: selectedWorkType?.label ?? "업무",
      workTypeId: selectedWorkType?.id ?? null,
      primaryWork: normalizeText(row.primaryWork),
      secondaryWork: normalizeText(row.secondaryWork),
      destinationId: normalizeNullableId(row.destinationId),
      memo: normalizeText(row.memo),
      sortOrder: normalizeSortOrder(row.sortOrder),
      updatedAt: now,
    };

    const updatedRows = await db
      .update(workDiaryEntries)
      .set(values)
      .where(and(eq(workDiaryEntries.userId, userId), eq(workDiaryEntries.workDate, workDate)))
      .returning({ id: workDiaryEntries.id });

    if (updatedRows.length === 0) {
      await db.insert(workDiaryEntries).values(values);
    }
  }

  for (const row of updated) {
    if (!row.id || row.id.startsWith("placeholder:")) {
      continue;
    }
    const existing = await db.query.workDiaryEntries.findFirst({
      where: eq(workDiaryEntries.id, row.id),
    });
    if (!existing) {
      continue;
    }
    if (role !== "admin" && existing.userId !== currentUserId) {
      throw new Error("본인 업무일지만 수정할 수 있습니다.");
    }

    const workDate = row.workDate ? normalizeWorkDate(row.workDate) : existing.workDate;
    const selectedWorkType =
      role === "admin" ? await resolveWorkType(row.workTypeId ?? existing.workTypeId, defaultWorkType) : null;
    const workTypePatch =
      role === "admin"
        ? {
            workType: selectedWorkType?.label ?? "업무",
            workTypeId: selectedWorkType?.id ?? null,
          }
        : {};
    const patch = {
      workDate,
      ...workTypePatch,
      primaryWork: normalizeText(row.primaryWork),
      secondaryWork: normalizeText(row.secondaryWork),
      destinationId: normalizeNullableId(row.destinationId),
      memo: normalizeText(row.memo),
      sortOrder: normalizeSortOrder(row.sortOrder),
      updatedAt: now,
    };

    const duplicate =
      workDate === existing.workDate
        ? null
        : await db.query.workDiaryEntries.findFirst({
            where: and(eq(workDiaryEntries.userId, existing.userId), eq(workDiaryEntries.workDate, workDate)),
          });

    if (duplicate) {
      await db.update(workDiaryEntries).set(patch).where(eq(workDiaryEntries.id, duplicate.id));
      await db.delete(workDiaryEntries).where(eq(workDiaryEntries.id, existing.id));
      continue;
    }

    await db
      .update(workDiaryEntries)
      .set(patch)
      .where(eq(workDiaryEntries.id, row.id));
  }

  for (const id of deleted) {
    if (!id || id.startsWith("placeholder:")) {
      continue;
    }
    const existing = await db.query.workDiaryEntries.findFirst({
      where: eq(workDiaryEntries.id, id),
    });
    if (!existing) {
      continue;
    }
    if (role !== "admin" && existing.userId !== currentUserId) {
      throw new Error("본인 업무일지만 삭제할 수 있습니다.");
    }
    await db.delete(workDiaryEntries).where(eq(workDiaryEntries.id, id));
  }

  return { ok: true };
}

export async function createWorkDiaryDestination(input: { code?: string; label: string }) {
  const label = normalizeRequiredText(input.label, "행선지명을 입력해 주세요.");

  if (input.code?.trim()) {
    const code = normalizeOptionCode(input.code, "행선지");
    const [row] = await getDb()
      .insert(workDiaryDestinations)
      .values({ code, label })
      .returning();

    return serializeDestination(row, 0);
  }

  for (let attempt = 0; attempt < WORK_DIARY_DESTINATION_CODE_INSERT_ATTEMPTS; attempt += 1) {
    const code = await generateNextWorkDiaryDestinationCode(attempt);
    const [row] = await getDb()
      .insert(workDiaryDestinations)
      .values({ code, label })
      .onConflictDoNothing({ target: workDiaryDestinations.code })
      .returning();

    if (row) {
      return serializeDestination(row, 0);
    }
  }

  throw new Error("행선지 코드를 자동채번하지 못했습니다. 다시 시도해 주세요.");
}

export async function updateWorkDiaryDestination(
  id: string,
  input: { code?: string; label?: string; sortOrder?: number; isActive?: boolean },
) {
  const patch = {
    ...(input.code != null ? { code: normalizeOptionCode(input.code, "행선지") } : {}),
    ...(input.label != null ? { label: normalizeRequiredText(input.label, "행선지명을 입력해 주세요.") } : {}),
    ...(input.sortOrder != null ? { sortOrder: normalizeSortOrder(input.sortOrder) } : {}),
    ...(input.isActive != null ? { isActive: input.isActive } : {}),
    updatedAt: new Date(),
  };

  const [row] = await getDb()
    .update(workDiaryDestinations)
    .set(patch)
    .where(eq(workDiaryDestinations.id, id))
    .returning();

  if (!row) {
    throw new Error("행선지를 찾지 못했습니다.");
  }

  return serializeDestination(row, await countDestinationUsage(id));
}

export async function deleteWorkDiaryDestination(id: string) {
  const usageCount = await countDestinationUsage(id);
  if (usageCount > 0) {
    const option = await updateWorkDiaryDestination(id, { isActive: false });
    return { deleted: false, option };
  }

  const [deleted] = await getDb()
    .delete(workDiaryDestinations)
    .where(eq(workDiaryDestinations.id, id))
    .returning({ id: workDiaryDestinations.id });
  if (!deleted) {
    throw new Error("행선지를 찾지 못했습니다.");
  }

  return { deleted: true, id };
}

export async function createWorkDiaryType(input: { code?: string; label: string; color?: string }) {
  const label = normalizeRequiredText(input.label, "업무구분명을 입력해 주세요.");
  const color = normalizeColor(input.color);

  if (input.code?.trim()) {
    const code = normalizeOptionCode(input.code, "업무구분");
    const [row] = await getDb()
      .insert(workDiaryTypes)
      .values({ code, label, color })
      .returning();

    return serializeWorkType(row, 0);
  }

  for (let attempt = 0; attempt < WORK_DIARY_TYPE_CODE_INSERT_ATTEMPTS; attempt += 1) {
    const code = await generateNextWorkDiaryTypeCode(attempt);
    const [row] = await getDb()
      .insert(workDiaryTypes)
      .values({ code, label, color })
      .onConflictDoNothing({ target: workDiaryTypes.code })
      .returning();

    if (row) {
      return serializeWorkType(row, 0);
    }
  }

  throw new Error("업무구분 코드를 자동채번하지 못했습니다. 다시 시도해 주세요.");
}

export async function updateWorkDiaryType(
  id: string,
  input: { code?: string; label?: string; color?: string; sortOrder?: number; isActive?: boolean },
) {
  const patch = {
    ...(input.code != null ? { code: normalizeOptionCode(input.code, "업무구분") } : {}),
    ...(input.label != null ? { label: normalizeRequiredText(input.label, "업무구분명을 입력해 주세요.") } : {}),
    ...(input.color != null ? { color: normalizeColor(input.color) } : {}),
    ...(input.sortOrder != null ? { sortOrder: normalizeSortOrder(input.sortOrder) } : {}),
    ...(input.isActive != null ? { isActive: input.isActive } : {}),
    updatedAt: new Date(),
  };

  const [row] = await getDb()
    .update(workDiaryTypes)
    .set(patch)
    .where(eq(workDiaryTypes.id, id))
    .returning();

  if (!row) {
    throw new Error("업무구분을 찾지 못했습니다.");
  }

  return serializeWorkType(row, await countWorkTypeUsage(id));
}

export async function deleteWorkDiaryType(id: string) {
  const usageCount = await countWorkTypeUsage(id);
  if (usageCount > 0) {
    const option = await updateWorkDiaryType(id, { isActive: false });
    return { deleted: false, option };
  }

  const [deleted] = await getDb()
    .delete(workDiaryTypes)
    .where(eq(workDiaryTypes.id, id))
    .returning({ id: workDiaryTypes.id });
  if (!deleted) {
    throw new Error("업무구분을 찾지 못했습니다.");
  }

  return { deleted: true, id };
}

function mergeMonthlyPlaceholders(
  month: string,
  userId: string,
  userName: string,
  rows: WorkDiaryRow[],
) {
  const byDate = new Map<string, WorkDiaryRow[]>();
  rows.forEach((row) => {
    byDate.set(row.workDate, [...(byDate.get(row.workDate) ?? []), row]);
  });

  const result: WorkDiaryRow[] = [];
  for (const date of listDatesInMonth(month)) {
    const existingRows = byDate.get(date);
    if (existingRows?.length) {
      result.push(...existingRows);
    } else {
      result.push(createPlaceholderRow(date, userId, userName));
    }
  }
  return result;
}

function dedupeWorkDiaryRowsByDate(rows: WorkDiaryRow[]) {
  const byDate = new Map<string, WorkDiaryRow>();
  for (const row of rows) {
    const existing = byDate.get(row.workDate);
    if (!existing || compareWorkDiaryRowsForKeep(row, existing) > 0) {
      byDate.set(row.workDate, row);
    }
  }
  return [...byDate.values()].sort((left, right) => left.workDate.localeCompare(right.workDate));
}

function compareWorkDiaryRowsForKeep(left: WorkDiaryRow, right: WorkDiaryRow) {
  const scoreDiff = workDiaryContentScore(left) - workDiaryContentScore(right);
  if (scoreDiff !== 0) return scoreDiff;
  return (left.updatedAt ?? "").localeCompare(right.updatedAt ?? "") ||
    (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
}

function workDiaryContentScore(row: WorkDiaryRow) {
  return [
    row.primaryWork,
    row.secondaryWork,
    row.memo,
    row.destinationId,
    row.workTypeId,
  ].filter((value) => normalizeText(value)).length;
}

function buildPlaceholderRows(month: string, userId: string, userName: string) {
  return listDatesInMonth(month).map((date) => createPlaceholderRow(date, userId, userName));
}

function createPlaceholderRow(date: string, userId: string, userName: string): WorkDiaryRow {
  return {
    id: `placeholder:${date}`,
    userId,
    userName,
    workDate: date,
    workType: "업무",
    workTypeId: null,
    workTypeCode: null,
    workTypeLabel: null,
    workTypeColor: null,
    primaryWork: "",
    secondaryWork: "",
    destinationId: null,
    destinationCode: null,
    destinationLabel: null,
    memo: "",
    sortOrder: 0,
    isPlaceholder: true,
    createdAt: null,
    updatedAt: null,
  };
}

function getMonthBounds(month: string): [string, string] {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
  return [`${month}-01`, next];
}

function listDatesInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function normalizeWorkDate(value: string | undefined) {
  const date = value?.trim();
  if (!date || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
    throw new Error("업무일자는 YYYY-MM-DD 형식이어야 합니다.");
  }
  return date;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRequiredText(value: unknown, message: string) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function normalizeOptionCode(value: unknown, label: string) {
  const code = normalizeRequiredText(value, `${label} 코드를 입력해 주세요.`)
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!/^[A-Z0-9_-]{1,40}$/.test(code)) {
    throw new Error(`${label} 코드는 영문, 숫자, _, - 조합 40자 이하로 입력해 주세요.`);
  }
  return code;
}

async function generateNextWorkDiaryTypeCode(offset: number) {
  const rows = await getDb()
    .select({ code: workDiaryTypes.code })
    .from(workDiaryTypes)
    .where(sql`${workDiaryTypes.code} like ${`${WORK_DIARY_TYPE_CODE_PREFIX}_%`}`);
  const codePattern = new RegExp(`^${WORK_DIARY_TYPE_CODE_PREFIX}_(\\d+)$`);
  const maxNumber = rows.reduce((max, row) => {
    const match = codePattern.exec(row.code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${WORK_DIARY_TYPE_CODE_PREFIX}_${String(maxNumber + 1 + offset).padStart(WORK_DIARY_TYPE_CODE_PAD_LENGTH, "0")}`;
}

async function generateNextWorkDiaryDestinationCode(offset: number) {
  const rows = await getDb()
    .select({ code: workDiaryDestinations.code })
    .from(workDiaryDestinations)
    .where(sql`${workDiaryDestinations.code} like ${`${WORK_DIARY_DESTINATION_CODE_PREFIX}_%`}`);
  const codePattern = new RegExp(`^${WORK_DIARY_DESTINATION_CODE_PREFIX}_(\\d+)$`);
  const maxNumber = rows.reduce((max, row) => {
    const match = codePattern.exec(row.code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `${WORK_DIARY_DESTINATION_CODE_PREFIX}_${String(maxNumber + 1 + offset).padStart(WORK_DIARY_DESTINATION_CODE_PAD_LENGTH, "0")}`;
}

function normalizeNullableId(value: unknown) {
  const id = String(value ?? "").trim();
  return id ? id : null;
}

function normalizeColor(value: unknown) {
  const color = normalizeText(value) || "#475569";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("색상은 #RRGGBB 형식으로 입력해 주세요.");
  }
  return color.toLowerCase();
}

function normalizeSortOrder(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
}

async function countDestinationUsage(id: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(workDiaryEntries)
    .where(eq(workDiaryEntries.destinationId, id));
  return row?.value ?? 0;
}

async function countWorkTypeUsage(id: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(workDiaryEntries)
    .where(eq(workDiaryEntries.workTypeId, id));
  return row?.value ?? 0;
}

async function resolveDefaultWorkType() {
  const byCode = await getDb().query.workDiaryTypes.findFirst({
    where: eq(workDiaryTypes.code, "WORK"),
  });
  if (byCode?.isActive) return byCode;

  const firstActive = await getDb().query.workDiaryTypes.findFirst({
    where: eq(workDiaryTypes.isActive, true),
    orderBy: [asc(workDiaryTypes.sortOrder), asc(workDiaryTypes.label)],
  });
  return firstActive ?? byCode ?? null;
}

async function resolveWorkType(id: string | null | undefined, fallback: typeof workDiaryTypes.$inferSelect | null) {
  const normalizedId = normalizeNullableId(id);
  if (!normalizedId) return fallback;

  const row = await getDb().query.workDiaryTypes.findFirst({
    where: eq(workDiaryTypes.id, normalizedId),
  });
  if (!row) {
    throw new Error("업무구분을 찾지 못했습니다.");
  }
  return row;
}

function serializeDestination(
  row: typeof workDiaryDestinations.$inferSelect,
  usageCount: number,
): WorkDiaryDestinationRow {
  return {
    ...row,
    usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeWorkType(row: typeof workDiaryTypes.$inferSelect, usageCount: number): WorkDiaryTypeRow {
  return {
    ...row,
    usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
