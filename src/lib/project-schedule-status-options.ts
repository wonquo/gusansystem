import { count, eq, sql } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { projectScheduleStatusOptions, projectSchedules } from "@/db/schema";
import type { ProjectScheduleStatusOptionRow } from "./types";

export const DEFAULT_PROJECT_SCHEDULE_STATUS_OPTIONS = [
  { label: "대기", color: "#64748b" },
  { label: "진행중", color: "#2f70dc" },
  { label: "보류", color: "#d97706" },
  { label: "완료", color: "#059669" },
  { label: "취소", color: "#dc2626" },
];

export async function listProjectScheduleStatusOptions(): Promise<ProjectScheduleStatusOptionRow[]> {
  if (!hasDatabaseUrl()) {
    return getDemoProjectScheduleStatusOptionRows();
  }

  await ensureDefaultProjectScheduleStatusOptions();

  const db = getDb();
  const [options, statusCounts] = await Promise.all([
    db.query.projectScheduleStatusOptions.findMany({
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.label)],
    }),
    db
      .select({ label: projectSchedules.status, usageCount: count() })
      .from(projectSchedules)
      .where(sql`${projectSchedules.status} is not null and ${projectSchedules.status} <> ''`)
      .groupBy(projectSchedules.status),
  ]);

  const usage = new Map(statusCounts.map((row) => [row.label ?? "", row.usageCount]));
  const managedLabels = new Set(options.map((option) => option.label));

  return [
    ...options.map((option) => serializeProjectScheduleStatusOption(option, usage.get(option.label) ?? 0)),
    ...unmanagedProjectScheduleStatusRows(usage, managedLabels),
  ];
}

export async function createProjectScheduleStatusOption(input: {
  label: string;
  color?: string | null;
}) {
  const label = normalizeLabel(input.label);
  const color = normalizeColor(input.color);

  if (!hasDatabaseUrl()) {
    return demoProjectScheduleStatusOption(label, color);
  }

  const [lastOption] = await getDb()
    .select({ sortOrder: projectScheduleStatusOptions.sortOrder })
    .from(projectScheduleStatusOptions)
    .orderBy(sql`${projectScheduleStatusOptions.sortOrder} desc`)
    .limit(1);

  await getDb()
    .insert(projectScheduleStatusOptions)
    .values({
      label,
      color,
      sortOrder: (lastOption?.sortOrder ?? -1) + 1,
    })
    .onConflictDoUpdate({
      target: projectScheduleStatusOptions.label,
      set: { color, isActive: true, updatedAt: new Date() },
    });

  const option = await getDb().query.projectScheduleStatusOptions.findFirst({
    where: eq(projectScheduleStatusOptions.label, label),
  });

  if (!option) {
    throw new Error("상태를 저장하지 못했습니다.");
  }

  return serializeProjectScheduleStatusOption(option, await getProjectScheduleStatusUsageCount(label));
}

export async function updateProjectScheduleStatusOption(
  id: string,
  input: Partial<{
    label: string;
    color: string;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const existing = await getDb().query.projectScheduleStatusOptions.findFirst({
    where: eq(projectScheduleStatusOptions.id, id),
  });

  if (!existing) {
    throw new Error("상태 옵션을 찾을 수 없습니다.");
  }

  const nextLabel = input.label === undefined ? existing.label : normalizeLabel(input.label);
  const changes: Partial<typeof projectScheduleStatusOptions.$inferInsert> = {
    label: nextLabel,
    updatedAt: new Date(),
  };

  if (input.color !== undefined) {
    changes.color = normalizeColor(input.color);
  }
  if (input.isActive !== undefined) {
    changes.isActive = input.isActive;
  }
  if (input.sortOrder !== undefined) {
    changes.sortOrder = input.sortOrder;
  }

  const [updated] = await getDb()
    .update(projectScheduleStatusOptions)
    .set(changes)
    .where(eq(projectScheduleStatusOptions.id, id))
    .returning();

  if (nextLabel !== existing.label) {
    await getDb()
      .update(projectSchedules)
      .set({ status: nextLabel, updatedAt: new Date() })
      .where(eq(projectSchedules.status, existing.label));
  }

  return serializeProjectScheduleStatusOption(updated, await getProjectScheduleStatusUsageCount(nextLabel));
}

export async function deleteProjectScheduleStatusOption(id: string) {
  if (!hasDatabaseUrl()) {
    return { deleted: id };
  }

  await getDb().delete(projectScheduleStatusOptions).where(eq(projectScheduleStatusOptions.id, id));
  return { deleted: id };
}

export async function renameProjectScheduleStatusValue(input: {
  fromLabel: string;
  label: string;
  color?: string | null;
}) {
  const fromLabel = normalizeLabel(input.fromLabel);
  const nextLabel = normalizeLabel(input.label);

  if (!hasDatabaseUrl()) {
    return demoProjectScheduleStatusOption(nextLabel, normalizeColor(input.color));
  }

  const option = await ensureProjectScheduleStatusOption(nextLabel, input.color);

  if (fromLabel !== nextLabel) {
    await getDb()
      .update(projectSchedules)
      .set({ status: nextLabel, updatedAt: new Date() })
      .where(eq(projectSchedules.status, fromLabel));
  }

  return serializeProjectScheduleStatusOption(option, await getProjectScheduleStatusUsageCount(nextLabel));
}

async function ensureDefaultProjectScheduleStatusOptions() {
  await getDb()
    .insert(projectScheduleStatusOptions)
    .values(
      DEFAULT_PROJECT_SCHEDULE_STATUS_OPTIONS.map((option, index) => ({
        ...option,
        sortOrder: index,
      })),
    )
    .onConflictDoNothing({ target: projectScheduleStatusOptions.label });
}

async function ensureProjectScheduleStatusOption(label: string, color?: string | null) {
  const existing = await getDb().query.projectScheduleStatusOptions.findFirst({
    where: eq(projectScheduleStatusOptions.label, label),
  });

  if (existing) {
    return existing;
  }

  const [lastOption] = await getDb()
    .select({ sortOrder: projectScheduleStatusOptions.sortOrder })
    .from(projectScheduleStatusOptions)
    .orderBy(sql`${projectScheduleStatusOptions.sortOrder} desc`)
    .limit(1);

  const [created] = await getDb()
    .insert(projectScheduleStatusOptions)
    .values({
      label,
      color: normalizeColor(color),
      sortOrder: (lastOption?.sortOrder ?? -1) + 1,
    })
    .returning();

  return created;
}

async function getProjectScheduleStatusUsageCount(label: string) {
  const [row] = await getDb()
    .select({ usageCount: count() })
    .from(projectSchedules)
    .where(eq(projectSchedules.status, label));

  return row?.usageCount ?? 0;
}

function serializeProjectScheduleStatusOption(
  option: typeof projectScheduleStatusOptions.$inferSelect,
  usageCount: number,
): ProjectScheduleStatusOptionRow {
  return {
    id: option.id,
    label: option.label,
    color: option.color,
    sortOrder: option.sortOrder,
    isActive: option.isActive,
    usageCount,
    isManaged: true,
    createdAt: option.createdAt.toISOString(),
    updatedAt: option.updatedAt.toISOString(),
  };
}

function unmanagedProjectScheduleStatusRows(usage: Map<string, number>, managedLabels: Set<string>) {
  return Array.from(usage.entries())
    .filter(([label]) => label && !managedLabels.has(label))
    .map(([label, usageCount]) => ({
      id: `unmanaged-project-schedule-status-${label}`,
      label,
      color: "#64748b",
      sortOrder: 999,
      isActive: true,
      usageCount,
      isManaged: false,
      createdAt: null,
      updatedAt: null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

function getDemoProjectScheduleStatusOptionRows() {
  return DEFAULT_PROJECT_SCHEDULE_STATUS_OPTIONS.map((option, index) => ({
    id: `demo-project-schedule-status-${index}`,
    ...option,
    sortOrder: index,
    isActive: true,
    usageCount: 0,
    isManaged: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function demoProjectScheduleStatusOption(label: string, color: string): ProjectScheduleStatusOptionRow {
  return {
    id: `demo-project-schedule-status-${Date.now()}`,
    label,
    color,
    sortOrder: 999,
    isActive: true,
    usageCount: 0,
    isManaged: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLabel(label: string) {
  const value = label.trim();
  if (!value) {
    throw new Error("상태명을 입력해주세요.");
  }

  return value;
}

function normalizeColor(color?: string | null) {
  const value = color?.trim() || "#2f70dc";
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error("색상은 #RRGGBB 형식으로 입력해주세요.");
  }

  return value.toLowerCase();
}
