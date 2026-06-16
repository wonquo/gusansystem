import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, customerActivities, customerImportRows, customers, employees, importBatches } from "@/db/schema";
import { CUSTOMER_EMPTY_FACET } from "./types";
import { getDemoCustomers, getDemoUsers } from "./demo-data";
import type {
  AppUserRow,
  CustomerActivityRow,
  CustomerContactMethod,
  CustomerDashboardFilter,
  CustomerFacets,
  CustomerPageResult,
  CustomerRow,
  CustomerSortKey,
} from "./types";
import { serializeUser } from "./auth";
import type { ImportedCustomer } from "./customer-import";
import {
  SALES_POTENTIAL_OPTIONS,
  getSalesPotentialAliases,
  normalizeSalesPotential,
} from "./sales-potential";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 2000;
const MAX_ALL_PAGE_SIZE = 50000;
const CONTACT_ACTIVITY_TYPES = ["call", "sms"] as const satisfies readonly CustomerContactMethod[];

type CustomerListInput = {
  page?: number;
  pageSize?: number | "all";
  query?: string;
  source?: string | null;
  salesPotential?: string | null;
  status?: string | null;
  gender?: string | null;
  ageDecade?: string | null;
  dashboardFilter?: CustomerDashboardFilter | null;
  sortKey?: CustomerSortKey | null;
  sortDirection?: "asc" | "desc";
};

export async function listCustomers(assignedUserId?: string): Promise<CustomerRow[]> {
  if (!hasDatabaseUrl()) {
    return getDemoCustomers().map((customer) => ({
      ...customer,
      assignedUserId: assignedUserId ?? customer.assignedUserId,
    }));
  }

  const db = getDb();
  const query = db
    .select({
      customer: customers,
      assignedUserName: appUsers.name,
    })
    .from(customers)
    .leftJoin(appUsers, eq(customers.assignedUserId, appUsers.id));

  const rows = assignedUserId
    ? await query.where(eq(customers.assignedUserId, assignedUserId)).orderBy(desc(customers.updatedAt))
    : await query.orderBy(desc(customers.updatedAt));

  return rows.map(({ customer, assignedUserName }) =>
    serializeCustomer(customer, assignedUserName),
  );
}

export async function listCustomerPage(
  assignedUserId?: string,
  input: CustomerListInput = {},
): Promise<CustomerPageResult> {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);

  if (!hasDatabaseUrl()) {
    const rows = filterAndSortDemoCustomers(
      getDemoCustomers().map((customer) => ({
        ...customer,
        assignedUserId: assignedUserId ?? customer.assignedUserId,
      })),
      input,
    );
    const offset = (page - 1) * pageSize;
    const pageRows = rows.slice(offset, offset + pageSize);

    return {
      rows: pageRows,
      pageInfo: {
        page,
        pageSize,
        hasNextPage: offset + pageRows.length < rows.length,
        returned: pageRows.length,
        totalCount: rows.length,
      },
    };
  }

  const db = getDb();
  const where = buildCustomerWhere(assignedUserId, input);
  const [rows, totalResult] = await Promise.all([
    db
      .select({
        customer: customers,
        assignedUserName: appUsers.name,
      })
      .from(customers)
      .leftJoin(appUsers, eq(customers.assignedUserId, appUsers.id))
      .where(where)
      .orderBy(...buildCustomerOrder(input))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(customers).where(where),
  ]);
  const hasNextPage = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const totalCount = totalResult[0]?.value ?? 0;

  return {
    rows: pageRows.map(({ customer, assignedUserName }) =>
      serializeCustomer(customer, assignedUserName),
    ),
    pageInfo: {
      page,
      pageSize,
      hasNextPage,
      returned: pageRows.length,
      totalCount,
    },
  };
}

export async function getCustomerById(id: string, assignedUserId?: string): Promise<CustomerRow | null> {
  if (!hasDatabaseUrl()) {
    return getDemoCustomers().find((customer) => customer.id === id) ?? null;
  }

  const where = assignedUserId
    ? and(eq(customers.id, id), eq(customers.assignedUserId, assignedUserId))
    : eq(customers.id, id);
  const [row] = await getDb()
    .select({
      customer: customers,
      assignedUserName: appUsers.name,
    })
    .from(customers)
    .leftJoin(appUsers, eq(customers.assignedUserId, appUsers.id))
    .where(where)
    .limit(1);

  return row ? serializeCustomer(row.customer, row.assignedUserName) : null;
}

export async function listUsers(): Promise<AppUserRow[]> {
  if (!hasDatabaseUrl()) {
    return getDemoUsers();
  }

  const rows = await getDb()
    .select({
      user: appUsers,
      employeeCode: employees.employeeCode,
    })
    .from(appUsers)
    .leftJoin(employees, eq(employees.userId, appUsers.id))
    .orderBy(asc(appUsers.name));

  return rows.map(({ user, employeeCode }) => ({
    ...serializeUser(user),
    employeeCode,
  }));
}

export async function getDashboardStats(assignedUserId?: string) {
  if (hasDatabaseUrl()) {
    const baseWhere = assignedUserId ? eq(customers.assignedUserId, assignedUserId) : undefined;
    const statusLabel = sql<string>`coalesce(nullif(${customers.status}, ''), '미분류')`;
    const sourceLabel = sql<string>`coalesce(nullif(${customers.source}, ''), '미분류')`;
    const salesPotentialLabel = sql<string>`coalesce(nullif(${customers.salesPotential}, ''), '미분류')`;
    const [
      totalRows,
      openRows,
      callbackRows,
      blackRows,
      contactedRows,
      statusRows,
      sourceRows,
      salesPotentialRows,
      genderRows,
      ageDecadeRows,
      recentContactedRows,
    ] = await Promise.all([
      getDb().select({ value: count() }).from(customers).where(baseWhere),
      getDb()
        .select({ value: count() })
        .from(customers)
        .where(and(baseWhere, or(sql`${customers.status} is null`, sql`${customers.status} <> '블랙'`))),
      getDb()
        .select({ value: count() })
        .from(customers)
        .where(and(baseWhere, inArray(customers.status, ["다시 전화", "재통"]))),
      getDb().select({ value: count() }).from(customers).where(and(baseWhere, eq(customers.status, "블랙"))),
      getDb()
        .select({ value: count() })
        .from(customers)
        .where(
          and(
            baseWhere,
            or(
              isNotNull(customers.lastContactedAt),
              and(isNotNull(customers.lastContactedLabel), sql`${customers.lastContactedLabel} <> ''`),
            ),
          ),
        ),
      getDb()
        .select({ label: statusLabel, value: count() })
        .from(customers)
        .where(baseWhere)
        .groupBy(statusLabel)
        .orderBy(sql`count(*) desc`)
        .limit(8),
      getDb()
        .select({ label: sourceLabel, value: count() })
        .from(customers)
        .where(baseWhere)
        .groupBy(sourceLabel)
        .orderBy(sql`count(*) desc`)
        .limit(8),
      getDb()
        .select({ label: salesPotentialLabel, value: count() })
        .from(customers)
        .where(baseWhere)
        .groupBy(salesPotentialLabel)
        .orderBy(sql`count(*) desc`),
      getDb()
        .select({ label: sql<string>`coalesce(nullif(${customers.gender}, ''), '미분류')`, value: count() })
        .from(customers)
        .where(baseWhere)
        .groupBy(sql`coalesce(nullif(${customers.gender}, ''), '미분류')`)
        .orderBy(sql`count(*) desc`)
        .limit(8),
      getDb()
        .select({ label: sql<string>`coalesce(nullif(${customers.ageDecade}, ''), '미분류')`, value: count() })
        .from(customers)
        .where(baseWhere)
        .groupBy(sql`coalesce(nullif(${customers.ageDecade}, ''), '미분류')`)
        .orderBy(sql`count(*) desc`)
        .limit(8),
      getDb()
        .select({
          customer: customers,
          assignedUserName: appUsers.name,
        })
        .from(customers)
        .leftJoin(appUsers, eq(customers.assignedUserId, appUsers.id))
        .where(
          and(
            baseWhere,
            or(
              isNotNull(customers.lastContactedAt),
              and(isNotNull(customers.lastContactedLabel), sql`${customers.lastContactedLabel} <> ''`),
            ),
          ),
        )
        .orderBy(sql`${customers.lastContactedAt} desc nulls last`, desc(customers.updatedAt), desc(customers.id))
        .limit(6),
    ]);

    return {
      total: totalRows[0]?.value ?? 0,
      open: openRows[0]?.value ?? 0,
      callbacks: callbackRows[0]?.value ?? 0,
      black: blackRows[0]?.value ?? 0,
      contacted: contactedRows[0]?.value ?? 0,
      byStatus: statusRows,
      bySource: sourceRows,
      bySalesPotential: getSalesPotentialCountPairs(salesPotentialRows),
      byGender: genderRows,
      byAgeDecade: ageDecadeRows,
      recentContacted: recentContactedRows.map(({ customer, assignedUserName }) =>
        serializeCustomer(customer, assignedUserName),
      ),
    };
  }

  const rows = await listCustomers(assignedUserId);
  const openRows = rows.filter((row) => row.status !== "블랙");
  const callbackRows = rows.filter((row) => row.status === "다시 전화" || row.status === "재통");
  const blackRows = rows.filter((row) => row.status === "블랙");
  const contactedRows = rows.filter((row) => row.lastContactedAt || row.lastContactedLabel);

  return {
    total: rows.length,
    open: openRows.length,
    callbacks: callbackRows.length,
    black: blackRows.length,
    contacted: contactedRows.length,
    byStatus: getCountPairs(rows.map((row) => row.status ?? "미분류")),
    bySource: getCountPairs(rows.map((row) => row.source || "미분류")),
    bySalesPotential: getSalesPotentialCountPairs(
      rows.map((row) => ({ label: row.salesPotential ?? "미분류", value: 1 })),
    ),
    byGender: getCountPairs(rows.map((row) => row.gender ?? "미분류")),
    byAgeDecade: getCountPairs(rows.map((row) => row.ageDecade ?? "미분류")),
    recentContacted: rows
      .filter((row) => row.lastContactedAt || row.lastContactedLabel)
      .sort((left, right) => getContactedTime(right) - getContactedTime(left))
      .slice(0, 6),
  };
}

export async function getCustomerFacets(
  customerRows?: CustomerRow[],
  assignedUserId?: string,
): Promise<CustomerFacets> {
  if (hasDatabaseUrl() && !customerRows) {
    const db = getDb();
    const baseWhere = assignedUserId ? eq(customers.assignedUserId, assignedUserId) : undefined;
    const [
      sourceRows,
      salesPotentialRows,
      statusRows,
      genderRows,
      ageDecadeRows,
      ownerRows,
    ] =
      await Promise.all([
        db
          .selectDistinct({ value: customers.source })
          .from(customers)
          .where(and(baseWhere, sql`${customers.source} <> ''`))
          .orderBy(asc(customers.source))
          .limit(500),
        db
          .selectDistinct({ value: customers.salesPotential })
          .from(customers)
          .where(and(baseWhere, isNotNull(customers.salesPotential), sql`${customers.salesPotential} <> ''`))
          .orderBy(asc(customers.salesPotential))
          .limit(20),
        db
          .selectDistinct({ value: customers.status })
          .from(customers)
          .where(and(baseWhere, isNotNull(customers.status), sql`${customers.status} <> ''`))
          .orderBy(asc(customers.status))
          .limit(500),
        db
          .selectDistinct({ value: customers.gender })
          .from(customers)
          .where(and(baseWhere, isNotNull(customers.gender), sql`${customers.gender} <> ''`))
          .orderBy(asc(customers.gender))
          .limit(100),
        db
          .selectDistinct({ value: customers.ageDecade })
          .from(customers)
          .where(and(baseWhere, isNotNull(customers.ageDecade), sql`${customers.ageDecade} <> ''`))
          .orderBy(asc(customers.ageDecade))
          .limit(100),
        db
          .selectDistinct({ value: appUsers.name })
          .from(customers)
          .leftJoin(appUsers, eq(customers.assignedUserId, appUsers.id))
          .where(and(baseWhere, isNotNull(appUsers.name)))
          .orderBy(asc(appUsers.name))
          .limit(200),
      ]);

    const sources = sourceRows.map((row) => row.value).filter(isPresentString);
    const salesPotentials = salesPotentialRows
      .map((row) => normalizeSalesPotential(row.value))
      .filter(isPresentString);
    const statuses = statusRows.map((row) => row.value).filter(isPresentString);

    return {
      sources,
      salesPotentials,
      statuses,
      sourceOptions: sources,
      salesPotentialOptions: mergeUnique([...SALES_POTENTIAL_OPTIONS], salesPotentials),
      statusOptions: statuses,
      genders: genderRows.map((row) => row.value).filter(isPresentString),
      ageDecades: ageDecadeRows.map((row) => row.value).filter(isPresentString),
      owners: ownerRows.map((row) => row.value).filter(isPresentString),
    };
  }

  const rows = customerRows ?? (await listCustomers(assignedUserId));
  const sources = unique(rows.map((row) => row.source));
  const statuses = unique(rows.map((row) => row.status));

  return {
    sources,
    salesPotentials: unique(rows.map((row) => normalizeSalesPotential(row.salesPotential))),
    statuses,
    sourceOptions: sources,
    salesPotentialOptions: mergeUnique(
      [...SALES_POTENTIAL_OPTIONS],
      rows.map((row) => normalizeSalesPotential(row.salesPotential)),
    ),
    statusOptions: statuses,
    genders: unique(rows.map((row) => row.gender)),
    ageDecades: unique(rows.map((row) => row.ageDecade)),
    owners: unique(rows.map((row) => row.assignedUserName)),
  };
}

export async function updateCustomer(
  id: string,
  values: CustomerUpdateInput,
) {
  if (!hasDatabaseUrl()) {
    return getDemoCustomers(1)[0];
  }

  const allowed: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };

  if (values.source !== undefined) allowed.source = values.source;
  if (values.salesPotential !== undefined) allowed.salesPotential = values.salesPotential;
  if (values.phone !== undefined) allowed.phone = values.phone;
  if (values.gender !== undefined) allowed.gender = values.gender;
  if (values.ageDecade !== undefined) allowed.ageDecade = values.ageDecade;
  if (values.status !== undefined) allowed.status = values.status;
  if (values.callNote !== undefined) allowed.callNote = values.callNote;
  if (values.lastContactedAt !== undefined) {
    allowed.lastContactedAt = values.lastContactedAt ? new Date(values.lastContactedAt) : null;
  }
  if (values.lastContactedLabel !== undefined) {
    allowed.lastContactedLabel = values.lastContactedLabel;
  }
  if (values.orderNote !== undefined) allowed.orderNote = values.orderNote;
  if (values.remark !== undefined) allowed.remark = values.remark;
  if (values.assignedUserId !== undefined) allowed.assignedUserId = values.assignedUserId;

  const [updated] = await getDb()
    .update(customers)
    .set(allowed)
    .where(eq(customers.id, id))
    .returning();

  return serializeCustomer(updated, null);
}

export async function createCustomer(values: CustomerCreateInput) {
  if (!hasDatabaseUrl()) {
    const now = new Date().toISOString();

    return {
      ...getDemoCustomers(1)[0],
      id: randomUUID(),
      source: values.source ?? "",
      salesPotential: values.salesPotential ?? null,
      phone: values.phone ?? "",
      status: values.status ?? null,
      assignedUserId: values.assignedUserId ?? null,
      assignedUserName: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const [created] = await getDb()
    .insert(customers)
    .values({
      source: values.source ?? "",
      salesPotential: values.salesPotential ?? null,
      phone: values.phone ?? "",
      gender: values.gender ?? null,
      ageDecade: values.ageDecade ?? null,
      status: values.status ?? null,
      callNote: values.callNote ?? null,
      lastContactedAt: values.lastContactedAt ? new Date(values.lastContactedAt) : null,
      lastContactedLabel: values.lastContactedLabel ?? null,
      orderNote: values.orderNote ?? null,
      remark: values.remark ?? null,
      assignedUserId: values.assignedUserId ?? null,
    })
    .returning();

  let assignedUserName: string | null = null;

  if (created.assignedUserId) {
    const assignedUser = await getDb().query.appUsers.findFirst({
      where: eq(appUsers.id, created.assignedUserId),
    });
    assignedUserName = assignedUser?.name ?? null;
  }

  return serializeCustomer(created, assignedUserName);
}

type CustomerUpdateInput = Partial<{
  source: string;
  salesPotential: string | null;
  phone: string;
  gender: string | null;
  ageDecade: string | null;
  status: string | null;
  callNote: string | null;
  lastContactedAt: string | null;
  lastContactedLabel: string | null;
  orderNote: string | null;
  remark: string | null;
  assignedUserId: string | null;
}>;

type CustomerCreateInput = CustomerUpdateInput;

type CustomerContactActivityInput = {
  method: CustomerContactMethod;
  occurredAt: string;
  note?: string | null;
};

export async function bulkUpdateCustomers(input: {
  ids: string[];
  status?: string;
  assignedUserId?: string | null;
  tag?: string;
}) {
  if (!hasDatabaseUrl()) {
    return { updated: input.ids.length };
  }

  const db = getDb();

  if (input.status || input.assignedUserId !== undefined) {
    await db
      .update(customers)
      .set({
        status: input.status,
        assignedUserId: input.assignedUserId,
        updatedAt: new Date(),
      })
      .where(inArray(customers.id, input.ids));
  }

  if (input.tag) {
    await db
      .update(customers)
      .set({
        tags: sql`array(select distinct unnest(coalesce(${customers.tags}, '{}'::text[]) || array[${input.tag}]::text[]))`,
        updatedAt: new Date(),
      })
      .where(inArray(customers.id, input.ids));
  }

  return { updated: input.ids.length };
}

export async function deleteCustomers(ids: string[]) {
  if (!hasDatabaseUrl()) {
    return { deleted: ids.length };
  }

  await getDb().delete(customers).where(inArray(customers.id, ids));

  return { deleted: ids.length };
}

export async function listCustomerContactActivities(customerId: string): Promise<CustomerActivityRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const rows = await getDb().query.customerActivities.findMany({
    where: and(
      eq(customerActivities.customerId, customerId),
      inArray(customerActivities.type, CONTACT_ACTIVITY_TYPES),
    ),
    orderBy: (table, { desc }) => [desc(table.occurredAt), desc(table.createdAt)],
  });

  return rows.map(serializeCustomerActivity);
}

export async function replaceCustomerContactActivities(input: {
  customerId: string;
  createdBy: string;
  activities: CustomerContactActivityInput[];
}) {
  if (!hasDatabaseUrl()) {
    const now = new Date().toISOString();

    return {
      activities: input.activities.map((activity) => ({
        id: randomUUID(),
        customerId: input.customerId,
        method: activity.method,
        occurredAt: new Date(activity.occurredAt).toISOString(),
        note: activity.note ?? null,
        createdBy: input.createdBy,
        createdAt: now,
      })),
      latestContactedAt: getLatestOccurredAt(input.activities),
    };
  }

  const db = getDb();
  const normalizedActivities = input.activities
    .map((activity) => ({
      type: activity.method,
      note: normalizeOptionalText(activity.note),
      occurredAt: new Date(activity.occurredAt),
    }))
    .filter((activity) => Number.isFinite(activity.occurredAt.getTime()));

  await db
    .delete(customerActivities)
    .where(
      and(
        eq(customerActivities.customerId, input.customerId),
        inArray(customerActivities.type, CONTACT_ACTIVITY_TYPES),
      ),
    );

  if (normalizedActivities.length > 0) {
    await db.insert(customerActivities).values(
      normalizedActivities.map((activity) => ({
        customerId: input.customerId,
        type: activity.type,
        note: activity.note,
        occurredAt: activity.occurredAt,
        createdBy: input.createdBy,
      })),
    );
  }

  const latestContactedAt = getLatestOccurredAt(normalizedActivities);
  await db
    .update(customers)
    .set({
      lastContactedAt: latestContactedAt ? new Date(latestContactedAt) : null,
      lastContactedLabel: null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, input.customerId));

  const activities = await listCustomerContactActivities(input.customerId);

  return { activities, latestContactedAt };
}

export async function importCustomers(input: {
  fileName: string;
  sheetName: string;
  rows: ImportedCustomer[];
  importedBy: string;
}) {
  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const db = getDb();
  const mergedRows = mergeImportedCustomerRows(input.rows);
  const phones = mergedRows.map((row) => row.phone);
  const existingByPhone = new Map<string, typeof customers.$inferSelect>();

  for (let index = 0; index < phones.length; index += 500) {
    const phoneChunk = phones.slice(index, index + 500);
    if (!phoneChunk.length) continue;

    const existingRows = await db
      .select()
      .from(customers)
      .where(inArray(customers.phone, phoneChunk))
      .orderBy(desc(customers.updatedAt), desc(customers.id));

    for (const customer of existingRows) {
      if (!existingByPhone.has(customer.phone)) {
        existingByPhone.set(customer.phone, customer);
      }
    }
  }

  const [batch] = await db
    .insert(importBatches)
    .values({
      fileName: input.fileName,
      sheetName: input.sheetName,
      rowCount: input.rows.length,
      importedBy: input.importedBy,
    })
    .returning();

  const chunkSize = 500;
  const customerIdByPhone = new Map<string, string>();
  const rowsToInsert: ImportedCustomer[] = [];
  let inserted = 0;
  let updated = 0;

  for (const row of mergedRows) {
    const existing = existingByPhone.get(row.phone);

    if (!existing) {
      rowsToInsert.push(row);
      continue;
    }

    const [updatedCustomer] = await db
      .update(customers)
      .set(mergeImportedCustomer(existing, row, input.importedBy))
      .where(eq(customers.id, existing.id))
      .returning({ id: customers.id });

    if (updatedCustomer) {
      customerIdByPhone.set(row.phone, updatedCustomer.id);
      updated += 1;
    }
  }

  for (let index = 0; index < rowsToInsert.length; index += chunkSize) {
    const chunk = rowsToInsert.slice(index, index + chunkSize);
    const insertedCustomers = await db
      .insert(customers)
      .values(
        chunk.map((row) => ({
          source: row.source ?? "미분류",
          salesPotential: null,
          phone: row.phone,
          gender: row.gender,
          ageDecade: row.ageDecade,
          status: row.status,
          callNote: row.callNote,
          lastContactedAt: row.lastContactedAt,
          lastContactedLabel: row.lastContactedLabel,
          orderNote: row.orderNote,
          remark: row.remark,
          assignedUserId: input.importedBy,
        })),
      )
      .returning({ id: customers.id, phone: customers.phone });

    for (const customer of insertedCustomers) {
      customerIdByPhone.set(customer.phone, customer.id);
    }

    inserted += insertedCustomers.length;
  }

  for (let index = 0; index < input.rows.length; index += chunkSize) {
    const chunk = input.rows.slice(index, index + chunkSize);
    await db.insert(customerImportRows).values(
      chunk.map((row) => ({
        batchId: batch.id,
        customerId: customerIdByPhone.get(row.phone) ?? null,
        sourceRowNumber: row.sourceRowNumber,
        rawData: row.rawData,
      })),
    );
  }

  return {
    batchId: batch.id,
    imported: inserted + updated,
    inserted,
    updated,
    mergedDuplicates: input.rows.length - mergedRows.length,
  };
}

function mergeImportedCustomerRows(rows: ImportedCustomer[]) {
  const rowsByPhone = new Map<string, ImportedCustomer>();
  const phones: string[] = [];

  for (const row of rows) {
    const existing = rowsByPhone.get(row.phone);

    if (!existing) {
      rowsByPhone.set(row.phone, row);
      phones.push(row.phone);
      continue;
    }

    rowsByPhone.set(row.phone, mergeImportedRow(existing, row));
  }

  return phones
    .map((phone) => rowsByPhone.get(phone))
    .filter((row): row is ImportedCustomer => Boolean(row));
}

function mergeImportedRow(existing: ImportedCustomer, incoming: ImportedCustomer): ImportedCustomer {
  const hasLastContacted = hasImportedLastContacted(incoming);

  return {
    ...existing,
    source: preferImportedText(existing.source, incoming.source),
    gender: preferImportedText(existing.gender, incoming.gender),
    ageDecade: preferImportedText(existing.ageDecade, incoming.ageDecade),
    status: preferImportedText(existing.status, incoming.status),
    callNote: appendDistinctText(existing.callNote, incoming.callNote),
    lastContactedAt: hasLastContacted ? incoming.lastContactedAt : existing.lastContactedAt,
    lastContactedLabel: hasLastContacted ? incoming.lastContactedLabel : existing.lastContactedLabel,
    orderNote: appendDistinctText(existing.orderNote, incoming.orderNote),
    remark: appendDistinctText(existing.remark, incoming.remark),
    sourceRowNumber: incoming.sourceRowNumber,
    rawData: incoming.rawData,
  };
}

function mergeImportedCustomer(
  existing: typeof customers.$inferSelect,
  incoming: ImportedCustomer,
  importedBy: string,
): Partial<typeof customers.$inferInsert> {
  const hasLastContacted = hasImportedLastContacted(incoming);

  return {
    source: preferImportedText(existing.source, incoming.source) ?? "",
    gender: preferImportedText(existing.gender, incoming.gender),
    ageDecade: preferImportedText(existing.ageDecade, incoming.ageDecade),
    status: preferImportedText(existing.status, incoming.status),
    callNote: appendDistinctText(existing.callNote, incoming.callNote),
    lastContactedAt: hasLastContacted ? incoming.lastContactedAt : existing.lastContactedAt,
    lastContactedLabel: hasLastContacted ? incoming.lastContactedLabel : existing.lastContactedLabel,
    orderNote: appendDistinctText(existing.orderNote, incoming.orderNote),
    remark: appendDistinctText(existing.remark, incoming.remark),
    assignedUserId: existing.assignedUserId ?? importedBy,
    updatedAt: new Date(),
  };
}

function preferImportedText(existing: string | null, incoming: string | null) {
  return hasText(incoming) ? incoming : existing;
}

function appendDistinctText(existing: string | null, incoming: string | null) {
  if (!hasText(incoming)) {
    return existing;
  }

  if (!hasText(existing)) {
    return incoming;
  }

  const normalizedIncoming = normalizeComparableText(incoming);
  const existingParts = existing.split(/\r?\n/).map(normalizeComparableText);

  if (
    normalizeComparableText(existing) === normalizedIncoming ||
    existingParts.includes(normalizedIncoming)
  ) {
    return existing;
  }

  return `${existing}\n${incoming}`;
}

function hasImportedLastContacted(row: ImportedCustomer) {
  return row.lastContactedAt !== null || hasText(row.lastContactedLabel);
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function countRealCustomers() {
  if (!hasDatabaseUrl()) {
    return 0;
  }

  const [result] = await getDb()
    .select({ value: count() })
    .from(customers)
    .where(and(isNotNull(customers.phone)));

  return result.value;
}

function serializeCustomer(
  customer: typeof customers.$inferSelect,
  assignedUserName: string | null,
): CustomerRow {
  return {
    id: customer.id,
    source: customer.source,
    salesPotential: customer.salesPotential,
    phone: customer.phone,
    gender: customer.gender,
    ageDecade: customer.ageDecade,
    status: customer.status,
    callNote: customer.callNote,
    lastContactedAt: customer.lastContactedAt?.toISOString() ?? null,
    lastContactedLabel: customer.lastContactedLabel,
    orderNote: customer.orderNote,
    remark: customer.remark,
    tags: customer.tags,
    assignedUserId: customer.assignedUserId,
    assignedUserName,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

function serializeCustomerActivity(
  activity: typeof customerActivities.$inferSelect,
): CustomerActivityRow {
  return {
    id: activity.id,
    customerId: activity.customerId,
    method: activity.type === "sms" ? "sms" : "call",
    occurredAt: activity.occurredAt.toISOString(),
    note: activity.note,
    createdBy: activity.createdBy,
    createdAt: activity.createdAt.toISOString(),
  };
}

function buildCustomerWhere(assignedUserId: string | undefined, input: CustomerListInput) {
  const conditions: SQL[] = [];
  const query = input.query?.trim();

  if (assignedUserId) {
    conditions.push(eq(customers.assignedUserId, assignedUserId));
  }
  if (input.source) {
    conditions.push(
      isEmptyFacet(input.source)
        ? sql`coalesce(nullif(${customers.source}, ''), '미분류') = '미분류'`
        : eq(customers.source, input.source),
    );
  }
  if (input.salesPotential) {
    if (isEmptyFacet(input.salesPotential)) {
      conditions.push(sql`coalesce(nullif(${customers.salesPotential}, ''), '미분류') = '미분류'`);
    } else {
      const aliases = getSalesPotentialAliases(input.salesPotential);
      conditions.push(inArray(customers.salesPotential, aliases.length > 0 ? aliases : [input.salesPotential]));
    }
  }
  if (input.status) {
    conditions.push(
      isEmptyFacet(input.status)
        ? sql`coalesce(nullif(${customers.status}, ''), '미분류') = '미분류'`
        : eq(customers.status, input.status),
    );
  }
  if (input.gender) {
    conditions.push(
      isEmptyFacet(input.gender)
        ? sql`coalesce(nullif(${customers.gender}, ''), '미분류') = '미분류'`
        : eq(customers.gender, input.gender),
    );
  }
  if (input.ageDecade) {
    conditions.push(
      isEmptyFacet(input.ageDecade)
        ? sql`coalesce(nullif(${customers.ageDecade}, ''), '미분류') = '미분류'`
        : eq(customers.ageDecade, input.ageDecade),
    );
  }
  if (input.dashboardFilter === "open") {
    const openCondition = or(sql`${customers.status} is null`, sql`${customers.status} <> '블랙'`);
    if (openCondition) {
      conditions.push(openCondition);
    }
  }
  if (input.dashboardFilter === "callbacks") {
    conditions.push(inArray(customers.status, ["다시 전화", "재통"]));
  }
  if (input.dashboardFilter === "contacted") {
    const contactedCondition = or(
      isNotNull(customers.lastContactedAt),
      and(isNotNull(customers.lastContactedLabel), sql`${customers.lastContactedLabel} <> ''`),
    );
    if (contactedCondition) {
      conditions.push(contactedCondition);
    }
  }
  if (query) {
    const pattern = `%${query}%`;
    const searchCondition = or(
      ilike(customers.source, pattern),
      ilike(customers.salesPotential, pattern),
      ilike(customers.phone, pattern),
      ilike(customers.gender, pattern),
      ilike(customers.ageDecade, pattern),
      ilike(customers.status, pattern),
      ilike(customers.lastContactedLabel, pattern),
      ilike(customers.callNote, pattern),
      ilike(customers.orderNote, pattern),
      ilike(customers.remark, pattern),
      sql`array_to_string(${customers.tags}, ' ') ilike ${pattern}`,
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return and(...conditions);
}

function buildCustomerOrder(input: CustomerListInput) {
  const direction = input.sortDirection === "asc" ? asc : desc;

  switch (input.sortKey) {
    case "source":
      return [direction(customers.source), desc(customers.updatedAt), desc(customers.id)];
    case "salesPotential":
      return [direction(customers.salesPotential), desc(customers.updatedAt), desc(customers.id)];
    case "phone":
      return [direction(customers.phone), desc(customers.updatedAt), desc(customers.id)];
    case "gender":
      return [direction(customers.gender), desc(customers.updatedAt), desc(customers.id)];
    case "ageDecade":
      return [direction(customers.ageDecade), desc(customers.updatedAt), desc(customers.id)];
    case "status":
      return [direction(customers.status), desc(customers.updatedAt), desc(customers.id)];
    case "lastContacted":
      return [
        direction(customers.lastContactedAt),
        direction(customers.lastContactedLabel),
        desc(customers.id),
      ];
    case "callNote":
      return [direction(customers.callNote), desc(customers.updatedAt), desc(customers.id)];
    case "orderNote":
      return [direction(customers.orderNote), desc(customers.updatedAt), desc(customers.id)];
    case "remark":
      return [direction(customers.remark), desc(customers.updatedAt), desc(customers.id)];
    default:
      return [desc(customers.updatedAt), desc(customers.id)];
  }
}

function normalizePage(page: number | undefined) {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

function normalizePageSize(pageSize: number | "all" | undefined) {
  if (pageSize === "all") return MAX_ALL_PAGE_SIZE;
  if (!pageSize || !Number.isFinite(pageSize)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
}

function filterAndSortDemoCustomers(rows: CustomerRow[], input: CustomerListInput) {
  const query = input.query?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (input.source && !matchesFacetValue(row.source, input.source)) return false;
    if (
      input.salesPotential &&
      !matchesFacetValue(normalizeSalesPotential(row.salesPotential), input.salesPotential)
    ) {
      return false;
    }
    if (input.status && !matchesFacetValue(row.status, input.status)) return false;
    if (input.gender && !matchesFacetValue(row.gender, input.gender)) return false;
    if (input.ageDecade && !matchesFacetValue(row.ageDecade, input.ageDecade)) return false;
    if (input.dashboardFilter === "open" && row.status === "블랙") return false;
    if (input.dashboardFilter === "callbacks" && row.status !== "다시 전화" && row.status !== "재통") return false;
    if (input.dashboardFilter === "contacted" && !row.lastContactedAt && !row.lastContactedLabel) return false;
    if (!query) return true;

    return [
      row.source,
      row.salesPotential,
      row.phone,
      row.gender,
      row.ageDecade,
      row.status,
      row.lastContactedLabel,
      row.lastContactedAt,
      row.callNote,
      row.orderNote,
      row.remark,
      row.tags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const sortKey = input.sortKey;

  if (!sortKey) return filtered;

  return filtered
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const compared = compareDemoSortValues(
        getDemoSortValue(a.row, sortKey),
        getDemoSortValue(b.row, sortKey),
      );
      const stableCompared = compared || a.index - b.index;

      return input.sortDirection === "desc" ? -stableCompared : stableCompared;
    })
    .map(({ row }) => row);
}

function getDemoSortValue(row: CustomerRow, key: CustomerSortKey) {
  if (key === "lastContacted") return row.lastContactedAt ?? row.lastContactedLabel ?? "";
  return row[key] ?? "";
}

function compareDemoSortValues(left: string, right: string) {
  return left.localeCompare(right, "ko", { numeric: true, sensitivity: "base" });
}

function getContactedTime(row: CustomerRow) {
  const time = row.lastContactedAt ? new Date(row.lastContactedAt).getTime() : NaN;

  return Number.isFinite(time) ? time : 0;
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function mergeUnique(primary: string[], fallback: Array<string | null>) {
  return Array.from(
    new Set([...primary, ...fallback.filter((value): value is string => Boolean(value))]),
  );
}

function isPresentString(value: string | null): value is string {
  return Boolean(value);
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isEmptyFacet(value: string) {
  return value === CUSTOMER_EMPTY_FACET || value === "미분류";
}

function matchesFacetValue(rowValue: string | null, filterValue: string) {
  if (isEmptyFacet(filterValue)) {
    return !rowValue || rowValue === "미분류";
  }

  return rowValue === filterValue;
}

function getLatestOccurredAt(activities: Array<{ occurredAt: string | Date }>) {
  const latestTime = activities.reduce<number | null>((latest, activity) => {
    const time = new Date(activity.occurredAt).getTime();
    if (!Number.isFinite(time)) return latest;
    return latest === null || time > latest ? time : latest;
  }, null);

  return latestTime === null ? null : new Date(latestTime).toISOString();
}

function getCountPairs(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function getSalesPotentialCountPairs(pairs: Array<{ label: string; value: number }>) {
  const primaryLabels = new Set<string>(SALES_POTENTIAL_OPTIONS);
  const counts = new Map<string, number>(SALES_POTENTIAL_OPTIONS.map((label) => [label, 0]));

  pairs.forEach((pair) => {
    const label = normalizeSalesPotential(pair.label) ?? "미분류";
    counts.set(label, (counts.get(label) ?? 0) + Number(pair.value));
  });

  const primaryPairs = SALES_POTENTIAL_OPTIONS.map((label) => ({
    label,
    value: counts.get(label) ?? 0,
  }));
  const extraPairs = Array.from(counts.entries())
    .filter(([label, value]) => !primaryLabels.has(label) && value > 0)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return [...primaryPairs, ...extraPairs];
}
