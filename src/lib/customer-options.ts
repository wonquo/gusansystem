import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { customerOptions, customers, type CustomerOptionType } from "@/db/schema";
import { getDemoCustomers } from "./demo-data";
import type { CustomerOptionRow } from "./types";

export const DEFAULT_CUSTOMER_OPTIONS: Record<CustomerOptionType, string[]> = {
  source: ["회사디비", "지산동", "수성구팀장님", "웅팀장님 맞디비"],
  status: ["신규", "다시 전화", "재통", "블랙", "타지역", "부동산", "아파트"],
};

export async function listCustomerOptions(): Promise<CustomerOptionRow[]> {
  if (!hasDatabaseUrl()) {
    return getDemoOptionRows();
  }

  await ensureDefaultCustomerOptions();

  const db = getDb();
  const [options, sourceCounts, statusCounts] = await Promise.all([
    db.query.customerOptions.findMany({
      orderBy: (table, { asc }) => [asc(table.type), asc(table.sortOrder), asc(table.label)],
    }),
    db
      .select({ label: customers.source, usageCount: count() })
      .from(customers)
      .where(sql`${customers.source} <> ''`)
      .groupBy(customers.source),
    db
      .select({ label: customers.status, usageCount: count() })
      .from(customers)
      .where(sql`${customers.status} is not null and ${customers.status} <> ''`)
      .groupBy(customers.status),
  ]);

  const usage = {
    source: new Map(sourceCounts.map((row) => [row.label, row.usageCount])),
    status: new Map(statusCounts.map((row) => [row.label ?? "", row.usageCount])),
  };
  const managedKeys = new Set(options.map((option) => keyFor(option.type, option.label)));

  return [
    ...options.map((option) => serializeOption(option, usage[option.type].get(option.label) ?? 0)),
    ...unmanagedRows("source", usage.source, managedKeys),
    ...unmanagedRows("status", usage.status, managedKeys),
  ];
}

export async function getCustomerOptionLabels(type: CustomerOptionType) {
  if (!hasDatabaseUrl()) {
    return DEFAULT_CUSTOMER_OPTIONS[type];
  }

  await ensureDefaultCustomerOptions();

  const rows = await getDb()
    .select({ label: customerOptions.label })
    .from(customerOptions)
    .where(and(eq(customerOptions.type, type), eq(customerOptions.isActive, true)))
    .orderBy(asc(customerOptions.sortOrder), asc(customerOptions.label));

  return rows.map((row) => row.label);
}

export async function createCustomerOption(input: {
  type: CustomerOptionType;
  label: string;
}) {
  const label = normalizeLabel(input.label);

  if (!hasDatabaseUrl()) {
    return demoOption(input.type, label);
  }

  const [lastOption] = await getDb()
    .select({ sortOrder: customerOptions.sortOrder })
    .from(customerOptions)
    .where(eq(customerOptions.type, input.type))
    .orderBy(sql`${customerOptions.sortOrder} desc`)
    .limit(1);

  const [created] = await getDb()
    .insert(customerOptions)
    .values({
      type: input.type,
      label,
      sortOrder: (lastOption?.sortOrder ?? -1) + 1,
    })
    .returning();

  return serializeOption(created, await getOptionUsageCount(input.type, label));
}

export async function updateCustomerOption(
  id: string,
  input: Partial<{
    label: string;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const existing = await getDb().query.customerOptions.findFirst({
    where: eq(customerOptions.id, id),
  });

  if (!existing) {
    throw new Error("옵션을 찾을 수 없습니다.");
  }

  const nextLabel = input.label === undefined ? existing.label : normalizeLabel(input.label);
  const changes: Partial<typeof customerOptions.$inferInsert> = {
    label: nextLabel,
    updatedAt: new Date(),
  };

  if (input.isActive !== undefined) {
    changes.isActive = input.isActive;
  }
  if (input.sortOrder !== undefined) {
    changes.sortOrder = input.sortOrder;
  }

  const [updated] = await getDb()
    .update(customerOptions)
    .set(changes)
    .where(eq(customerOptions.id, id))
    .returning();

  if (nextLabel !== existing.label) {
    const targetColumn = existing.type === "source" ? customers.source : customers.status;

    await getDb()
      .update(customers)
      .set({ [existing.type]: nextLabel, updatedAt: new Date() })
      .where(eq(targetColumn, existing.label));
  }

  return serializeOption(updated, await getOptionUsageCount(existing.type, nextLabel));
}

export async function deleteCustomerOption(id: string) {
  if (!hasDatabaseUrl()) {
    return { deleted: id };
  }

  await getDb().delete(customerOptions).where(eq(customerOptions.id, id));

  return { deleted: id };
}

export async function renameCustomerOptionValue(input: {
  type: CustomerOptionType;
  fromLabel: string;
  label: string;
}) {
  const fromLabel = normalizeLabel(input.fromLabel);
  const nextLabel = normalizeLabel(input.label);

  if (!hasDatabaseUrl()) {
    return demoOption(input.type, nextLabel);
  }

  const option = await ensureCustomerOption(input.type, nextLabel);

  if (fromLabel !== nextLabel) {
    const targetColumn = input.type === "source" ? customers.source : customers.status;

    await getDb()
      .update(customers)
      .set({ [input.type]: nextLabel, updatedAt: new Date() })
      .where(eq(targetColumn, fromLabel));
  }

  return serializeOption(option, await getOptionUsageCount(input.type, nextLabel));
}

async function ensureDefaultCustomerOptions() {
  const values = Object.entries(DEFAULT_CUSTOMER_OPTIONS).flatMap(([type, labels]) =>
    labels.map((label, index) => ({
      type: type as CustomerOptionType,
      label,
      sortOrder: index,
    })),
  );

  await getDb()
    .insert(customerOptions)
    .values(values)
    .onConflictDoNothing({
      target: [customerOptions.type, customerOptions.label],
    });
}

async function ensureCustomerOption(type: CustomerOptionType, label: string) {
  const db = getDb();
  const existing = await db.query.customerOptions.findFirst({
    where: and(eq(customerOptions.type, type), eq(customerOptions.label, label)),
  });

  if (existing) {
    return existing;
  }

  const [lastOption] = await db
    .select({ sortOrder: customerOptions.sortOrder })
    .from(customerOptions)
    .where(eq(customerOptions.type, type))
    .orderBy(sql`${customerOptions.sortOrder} desc`)
    .limit(1);

  await db
    .insert(customerOptions)
    .values({
      type,
      label,
      sortOrder: (lastOption?.sortOrder ?? -1) + 1,
    })
    .onConflictDoNothing({
      target: [customerOptions.type, customerOptions.label],
    });

  const option = await db.query.customerOptions.findFirst({
    where: and(eq(customerOptions.type, type), eq(customerOptions.label, label)),
  });

  if (!option) {
    throw new Error("옵션을 저장하지 못했습니다.");
  }

  return option;
}

async function getOptionUsageCount(type: CustomerOptionType, label: string) {
  const targetColumn = type === "source" ? customers.source : customers.status;
  const [row] = await getDb()
    .select({ usageCount: count() })
    .from(customers)
    .where(eq(targetColumn, label));

  return row?.usageCount ?? 0;
}

function serializeOption(
  option: typeof customerOptions.$inferSelect,
  usageCount: number,
): CustomerOptionRow {
  return {
    id: option.id,
    type: option.type,
    label: option.label,
    sortOrder: option.sortOrder,
    isActive: option.isActive,
    usageCount,
    isManaged: true,
    createdAt: option.createdAt.toISOString(),
    updatedAt: option.updatedAt.toISOString(),
  };
}

function unmanagedRows(
  type: CustomerOptionType,
  usage: Map<string, number>,
  managedKeys: Set<string>,
) {
  return Array.from(usage.entries())
    .filter(([label]) => label && !managedKeys.has(keyFor(type, label)))
    .map(([label, usageCount]) => ({
      id: `unmanaged-${type}-${label}`,
      type,
      label,
      sortOrder: 999,
      isActive: true,
      usageCount,
      isManaged: false,
      createdAt: null,
      updatedAt: null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

function getDemoOptionRows() {
  const rows = getDemoCustomers();
  const usage = {
    source: countBy(rows.map((row) => row.source)),
    status: countBy(rows.map((row) => row.status ?? "")),
  };

  return (Object.entries(DEFAULT_CUSTOMER_OPTIONS) as Array<[CustomerOptionType, string[]]>).flatMap(
    ([type, labels]) =>
      labels.map((label, index) => ({
        id: `demo-${type}-${index}`,
        type,
        label,
        sortOrder: index,
        isActive: true,
        usageCount: usage[type].get(label) ?? 0,
        isManaged: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
  );
}

function demoOption(type: CustomerOptionType, label: string): CustomerOptionRow {
  return {
    id: `demo-${type}-${Date.now()}`,
    type,
    label,
    sortOrder: 999,
    isActive: true,
    usageCount: 0,
    isManaged: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return counts;
}

function normalizeLabel(label: string) {
  const value = label.trim();
  if (!value) {
    throw new Error("옵션명을 입력해주세요.");
  }

  return value;
}

function keyFor(type: CustomerOptionType, label: string) {
  return `${type}:${label}`;
}
