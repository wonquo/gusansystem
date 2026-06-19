import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import {
  bankLedgers,
  bankTransactions,
  employees,
  importBatches,
  importRows,
  menuPermissions,
  payrollItems,
  payrollSlips,
  projectItems,
  projects,
  taxInvoices,
  type AppUserRole,
} from "@/db/schema";
import { ERP_MENUS, type ErpMenuKey, type PermissionAction } from "./menus";
import type { ProjectImportError, ProjectImportProject } from "./project-import";

export type GenericListParams = {
  query?: string | null;
  limit?: number;
};

export type GridRow = Record<string, unknown> & { id: string };

export type ProjectItemInput = {
  itemType?: unknown;
  orderedOn?: unknown;
  partnerName?: unknown;
  description?: unknown;
  contractAmount?: unknown;
  receivedAmount?: unknown;
  spentAmount?: unknown;
  paymentStatus?: unknown;
  paymentDate?: unknown;
  memo?: unknown;
  sourceSheetName?: unknown;
  sourceRowNumber?: unknown;
  sortOrder?: unknown;
};

export async function listProjects(params: GenericListParams = {}) {
  if (!hasDatabaseUrl()) {
    return [];
  }
  const query = params.query?.trim();
  const rows = await getDb().query.projects.findMany({
    where: query
      ? or(
          ilike(projects.projectName, `%${query}%`),
          ilike(projects.clientName, `%${query}%`),
          ilike(projects.sourceSheetName, `%${query}%`),
        )
      : undefined,
    with: {
      items: {
        orderBy: [asc(projectItems.sortOrder), asc(projectItems.sourceRowNumber)],
      },
    },
    orderBy: [desc(projects.updatedAt)],
    limit: params.limit ?? 500,
  });
  return rows.map((row) => ({
    ...row,
    orderedOn: row.orderedOn ?? null,
    startedOn: row.startedOn ?? null,
    endedOn: row.endedOn ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => ({
      ...item,
      orderedOn: item.orderedOn ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }));
}

export async function listTaxInvoices(params: GenericListParams = {}) {
  if (!hasDatabaseUrl()) {
    return [];
  }
  const query = params.query?.trim();
  const rows = await getDb().query.taxInvoices.findMany({
    where: query
      ? or(ilike(taxInvoices.partnerName, `%${query}%`), ilike(taxInvoices.projectName, `%${query}%`))
      : undefined,
    orderBy: [desc(taxInvoices.createdAt)],
    limit: params.limit ?? 500,
  });
  return rows.map((row) => ({
    ...row,
    issuedOn: row.issuedOn ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listBankTransactions(params: GenericListParams = {}) {
  if (!hasDatabaseUrl()) {
    return [];
  }
  const query = params.query?.trim();
  const rows = await getDb().query.bankTransactions.findMany({
    where: query
      ? or(
          ilike(bankTransactions.description, `%${query}%`),
          ilike(bankTransactions.category, `%${query}%`),
        )
      : undefined,
    orderBy: [desc(bankTransactions.transactedOn), desc(bankTransactions.createdAt)],
    limit: params.limit ?? 500,
  });
  return rows.map((row) => ({
    ...row,
    transactedOn: row.transactedOn ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listPayrollSlips({
  currentUserId,
  role,
  payrollMonth,
  payrollYear,
  payrollMonthNumber,
  employeeName,
  query,
  scope,
}: {
  currentUserId: string;
  role: AppUserRole;
  payrollMonth?: string | null;
  payrollYear?: string | null;
  payrollMonthNumber?: string | null;
  employeeName?: string | null;
  query?: string | null;
  scope?: "all" | "mine";
}) {
  if (!hasDatabaseUrl()) {
    return [];
  }
  const linkedEmployee = await getLinkedEmployeeForUser(currentUserId);
  const month = payrollMonth?.trim();
  const year = payrollYear?.trim();
  const monthNumberText = payrollMonthNumber?.trim();
  const monthNumber = monthNumberText ? monthNumberText.padStart(2, "0") : "";
  const name = employeeName?.trim();
  const search = query?.trim();
  const showAll = role === "admin" && scope !== "mine";
  const filters: SQL[] = [];

  if (!showAll) {
    filters.push(
      linkedEmployee
        ? eq(payrollSlips.employeeId, linkedEmployee.id)
        : eq(payrollSlips.employeeId, "00000000-0000-0000-0000-000000000000"),
    );
  }
  if (month) {
    filters.push(eq(payrollSlips.payrollMonth, month));
  } else if (year && monthNumber) {
    filters.push(eq(payrollSlips.payrollMonth, `${year}-${monthNumber}`));
  } else if (year) {
    filters.push(ilike(payrollSlips.payrollMonth, `${year}-%`));
  } else if (monthNumber) {
    filters.push(ilike(payrollSlips.payrollMonth, `%-${monthNumber}`));
  }
  if (name) {
    filters.push(ilike(payrollSlips.employeeName, `%${name}%`));
  }
  if (search) {
    const keywordFilter = or(
      ilike(payrollSlips.employeeName, `%${search}%`),
      ilike(payrollSlips.employeeCode, `%${search}%`),
      ilike(payrollSlips.position, `%${search}%`),
      ilike(payrollSlips.payrollMonth, `%${search}%`),
      ilike(payrollSlips.sourceSheetName, `%${search}%`),
    );
    if (keywordFilter) {
      filters.push(keywordFilter);
    }
  }

  const rows = await getDb().query.payrollSlips.findMany({
    where: filters.length ? and(...filters) : undefined,
    with: { items: true },
    orderBy: [desc(payrollSlips.payrollMonth), desc(payrollSlips.employeeName)],
    limit: 800,
  });
  return rows.map(serializePayrollSlip);
}

export async function getPayrollSlipById({
  id,
  currentUserId,
  role,
}: {
  id: string;
  currentUserId: string;
  role: AppUserRole;
}) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const linkedEmployee = await getLinkedEmployeeForUser(currentUserId);
  const row = await getDb().query.payrollSlips.findFirst({
    where: eq(payrollSlips.id, id),
    with: { items: true },
  });
  if (!row) {
    return null;
  }
  if (role !== "admin" && (!linkedEmployee || row.employeeId !== linkedEmployee.id)) {
    return null;
  }

  return serializePayrollSlip(row);
}

export async function deletePayrollSlip(id: string) {
  const [deleted] = await getDb()
    .delete(payrollSlips)
    .where(eq(payrollSlips.id, id))
    .returning({ id: payrollSlips.id });
  if (!deleted) {
    throw new Error("급여명세서를 찾지 못했습니다.");
  }
  return deleted;
}

function serializePayrollSlip(row: typeof payrollSlips.$inferSelect & { items: (typeof payrollItems.$inferSelect)[] }) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
  };
}

export async function listEmployees() {
  if (!hasDatabaseUrl()) {
    return [];
  }
  const rows = await getDb().query.employees.findMany({
    orderBy: [employees.name],
    with: { user: true },
  });
  return rows.map((row) => ({
    ...row,
    userName: row.user?.name ?? null,
    userLoginId: row.user?.loginId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listImportBatches() {
  if (!hasDatabaseUrl()) {
    return [];
  }
  const rows = await getDb().query.importBatches.findMany({
    with: { importer: true },
    orderBy: [desc(importBatches.createdAt)],
    limit: 300,
  });
  return rows.map((row) => ({
    ...row,
    importerName: row.importer?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPermissions() {
  const defaults = buildDefaultPermissions();
  if (!hasDatabaseUrl()) {
    return defaults;
  }

  const saved = await getDb().query.menuPermissions.findMany();
  const byKey = new Map(saved.map((row) => [`${row.role}:${row.menuKey}`, row]));
  return defaults.map((row) => {
    const savedRow = byKey.get(`${row.role}:${row.menuKey}`);
    return savedRow ? { ...row, ...savedRow } : row;
  });
}

export async function updatePermission(
  role: AppUserRole,
  menuKey: ErpMenuKey,
  patch: Partial<Record<PermissionAction, boolean>>,
) {
  const values = {
    canView: patch.view,
    canCreate: patch.create,
    canUpdate: patch.update,
    canDelete: patch.delete,
    canUpload: patch.upload,
  };
  const cleanPatch = Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "boolean"),
  );
  if (!hasDatabaseUrl()) {
    return { role, menuKey, ...cleanPatch };
  }

  const [row] = await getDb()
    .insert(menuPermissions)
    .values({
      role,
      menuKey,
      ...cleanPatch,
    })
    .onConflictDoUpdate({
      target: [menuPermissions.role, menuPermissions.menuKey],
      set: { ...cleanPatch, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function updatePermissionsForRole(
  role: AppUserRole,
  rows: {
    menuKey: ErpMenuKey;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canUpload: boolean;
  }[],
) {
  const values = rows.map((row) => ({
    role,
    menuKey: row.menuKey,
    canView: row.canView,
    canCreate: row.canCreate,
    canUpdate: row.canUpdate,
    canDelete: row.canDelete,
    canUpload: row.canUpload,
  }));

  if (!hasDatabaseUrl()) {
    return values;
  }

  if (values.length === 0) {
    return [];
  }

  return getDb()
    .insert(menuPermissions)
    .values(values)
    .onConflictDoUpdate({
      target: [menuPermissions.role, menuPermissions.menuKey],
      set: {
        canView: sql`excluded.can_view`,
        canCreate: sql`excluded.can_create`,
        canUpdate: sql`excluded.can_update`,
        canDelete: sql`excluded.can_delete`,
        canUpload: sql`excluded.can_upload`,
        updatedAt: new Date(),
      },
    })
    .returning();
}

export async function createProjectWithItems(data: Record<string, unknown>) {
  const db = getDb();
  const normalizedItems = normalizeProjectItemsInput(data.items);
  const projectValues = normalizeProjectWithItemTotals(data, normalizedItems);
  const [created] = await db.insert(projects).values(projectValues).returning();
  if (normalizedItems.length) {
    await db.insert(projectItems).values(toProjectItemRows(created.id, normalizedItems, "manual"));
  }
  return getProjectById(created.id);
}

export async function updateProjectWithItems(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!existing) {
    throw new Error("프로젝트를 찾지 못했습니다.");
  }
  const hasItemsPatch = Array.isArray(data.items);
  const normalizedItems = hasItemsPatch ? normalizeProjectItemsInput(data.items) : [];
  const projectValues = hasItemsPatch
    ? normalizeProjectWithItemTotals(data, normalizedItems)
    : normalizeProject(data);

  const [updated] = await db
    .update(projects)
    .set({ ...projectValues, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  if (hasItemsPatch) {
    await db.delete(projectItems).where(eq(projectItems.projectId, id));
    if (normalizedItems.length) {
      await db
        .insert(projectItems)
        .values(toProjectItemRows(id, normalizedItems, updated.sourceSheetName ?? "manual"));
    }
  }
  return getProjectById(id);
}

export async function deleteProject(id: string) {
  const [deleted] = await getDb().delete(projects).where(eq(projects.id, id)).returning();
  if (!deleted) {
    throw new Error("프로젝트를 찾지 못했습니다.");
  }
  return deleted;
}

export async function getProjectById(id: string) {
  const row = await getDb().query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      items: {
        orderBy: [asc(projectItems.sortOrder), asc(projectItems.sourceRowNumber)],
      },
    },
  });
  if (!row) {
    throw new Error("프로젝트를 찾지 못했습니다.");
  }
  return {
    ...row,
    orderedOn: row.orderedOn ?? null,
    startedOn: row.startedOn ?? null,
    endedOn: row.endedOn ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items.map((item) => ({
      ...item,
      orderedOn: item.orderedOn ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export async function getLinkedEmployeeForUser(userId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }
  return getDb().query.employees.findFirst({
    where: eq(employees.userId, userId),
  });
}

export async function upsertEmployeeFromPayroll(input: {
  employeeCode: string | null;
  name: string;
  position: string | null;
  payrollBankAccount: string | null;
}) {
  const db = getDb();
  const existing = input.employeeCode
    ? await db.query.employees.findFirst({
        where: eq(employees.employeeCode, input.employeeCode),
      })
    : await db.query.employees.findFirst({
        where: and(eq(employees.name, input.name), eq(employees.status, "active")),
      });

  if (existing) {
    const [updated] = await db
      .update(employees)
      .set({
        position: input.position ?? existing.position,
        payrollBankAccount: input.payrollBankAccount ?? existing.payrollBankAccount,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(employees)
    .values({
      employeeCode: input.employeeCode,
      name: input.name,
      position: input.position,
      payrollBankAccount: input.payrollBankAccount,
    })
    .returning();
  return created;
}

export async function savePayrollImport(input: {
  fileName: string;
  importType: string;
  sheetName: string;
  importedBy: string;
  slips: {
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
    items: { itemType: string; label: string; amount: number; sortOrder: number; rawData: unknown }[];
  }[];
  errors: { sheetName: string; sourceRowNumber: number; message: string; rawData: unknown }[];
}) {
  const db = getDb();
  const [batch] = await db
    .insert(importBatches)
    .values({
      fileName: input.fileName,
      sheetName: input.sheetName,
      importType: input.importType,
      detectedType: "payroll-slips",
      status: input.errors.length ? "failed" : "completed",
      rowCount: input.slips.length + input.errors.length,
      successCount: input.slips.length,
      errorCount: input.errors.length,
      resultSummary: { slips: input.slips.length, errors: input.errors.length },
      errorMessage: input.errors[0]?.message ?? null,
      importedBy: input.importedBy,
    })
    .returning();

  for (const slip of input.slips) {
    const employee = await upsertEmployeeFromPayroll({
      employeeCode: slip.employeeCode,
      name: slip.employeeName,
      position: slip.position,
      payrollBankAccount: slip.payrollBankAccount,
    });
    const [createdSlip] = await db
      .insert(payrollSlips)
      .values({
        employeeId: employee.id,
        employeeCode: slip.employeeCode,
        employeeName: slip.employeeName,
        position: slip.position,
        payrollMonth: slip.payrollMonth,
        payrollBankAccount: slip.payrollBankAccount,
        grossPay: slip.grossPay,
        totalDeduction: slip.totalDeduction,
        netPay: slip.netPay,
        sourceSheetName: slip.sourceSheetName,
        sourceBlock: slip.sourceBlock,
        rawData: slip.rawData,
        importBatchId: batch.id,
      })
      .returning();
    if (slip.items.length) {
      await db.insert(payrollItems).values(
        slip.items.map((item) => ({
          payrollSlipId: createdSlip.id,
          itemType: item.itemType,
          label: item.label,
          amount: item.amount,
          sortOrder: item.sortOrder,
          rawData: item.rawData,
        })),
      );
    }
    await db.insert(importRows).values({
      batchId: batch.id,
      targetTable: "payroll_slips",
      targetId: createdSlip.id,
      sheetName: slip.sourceSheetName,
      sourceRowNumber: 1,
      sourceCellRange: slip.sourceBlock,
      status: "imported",
      rawData: slip.rawData,
    });
  }

  for (const error of input.errors) {
    await db.insert(importRows).values({
      batchId: batch.id,
      sheetName: error.sheetName,
      sourceRowNumber: error.sourceRowNumber,
      status: "error",
      errorMessage: error.message,
      rawData: error.rawData as Record<string, unknown>,
    });
  }

  return batch;
}

export async function saveProjectImport(input: {
  fileName: string;
  importType: string;
  sheetName: string;
  importedBy: string;
  projects: ProjectImportProject[];
  errors: ProjectImportError[];
}) {
  const db = getDb();
  const [batch] = await db
    .insert(importBatches)
    .values({
      fileName: input.fileName,
      sheetName: input.sheetName,
      importType: input.importType,
      detectedType: "projects",
      status: input.errors.length ? "failed" : "completed",
      rowCount: input.projects.length + input.errors.length,
      successCount: input.projects.length,
      errorCount: input.errors.length,
      resultSummary: {
        projects: input.projects.length,
        items: input.projects.reduce((total, project) => total + project.items.length, 0),
        errors: input.errors.length,
      },
      errorMessage: input.errors[0]?.message ?? null,
      importedBy: input.importedBy,
    })
    .returning();

  for (const project of input.projects) {
    const existing = await db.query.projects.findFirst({
      where: and(
        eq(projects.sourceSheetName, project.sheetName),
        eq(projects.sourceStartRow, project.sourceStartRow),
        eq(projects.sourceTotalRow, project.sourceTotalRow),
      ),
    });
    const projectValues = projectImportValues(project, batch.id);
    const [savedProject] = existing
      ? await db
          .update(projects)
          .set({ ...projectValues, updatedAt: new Date() })
          .where(eq(projects.id, existing.id))
          .returning()
      : await db.insert(projects).values(projectValues).returning();

    await db.delete(projectItems).where(eq(projectItems.projectId, savedProject.id));
    if (project.items.length) {
      await db.insert(projectItems).values(
        project.items.map((item) => ({
          projectId: savedProject.id,
          itemType: item.itemType,
          sourceSheetName: item.sheetName,
          sourceRowNumber: item.sourceRowNumber,
          sortOrder: item.sortOrder,
          orderedOn: item.orderedOn,
          partnerName: item.partnerName,
          description: item.description,
          contractAmount: item.contractAmount,
          receivedAmount: item.receivedAmount,
          spentAmount: item.spentAmount,
          memo: item.memo,
          rawData: item.rawData,
        })),
      );
    }

    await db.insert(importRows).values({
      batchId: batch.id,
      targetTable: "projects",
      targetId: savedProject.id,
      sheetName: project.sheetName,
      sourceRowNumber: project.sourceStartRow,
      sourceCellRange: `${project.sourceStartRow}:${project.sourceEndRow}`,
      status: existing ? "updated" : "imported",
      rawData: project.rawData,
    });
  }

  for (const error of input.errors) {
    await db.insert(importRows).values({
      batchId: batch.id,
      sheetName: error.sheetName,
      sourceRowNumber: error.sourceRowNumber,
      status: "error",
      errorMessage: error.message,
      rawData: error.rawData,
    });
  }

  return batch;
}

export async function saveUnsupportedImport(input: {
  fileName: string;
  importType: string;
  sheetName: string;
  importedBy: string;
  message: string;
  rawData: Record<string, unknown>;
}) {
  const db = getDb();
  const [batch] = await db
    .insert(importBatches)
    .values({
      fileName: input.fileName,
      sheetName: input.sheetName,
      importType: input.importType,
      detectedType: input.importType,
      status: "failed",
      rowCount: 1,
      successCount: 0,
      errorCount: 1,
      resultSummary: { message: input.message },
      errorMessage: input.message,
      importedBy: input.importedBy,
    })
    .returning();

  await db.insert(importRows).values({
    batchId: batch.id,
    sheetName: input.sheetName,
    sourceRowNumber: 0,
    status: "mapping_required",
    errorMessage: input.message,
    rawData: input.rawData,
  });

  return batch;
}

export async function saveGenericRowsImport(input: {
  fileName: string;
  importType: string;
  sheetName: string;
  importedBy: string;
  rows: {
    sheetName: string;
    sourceRowNumber: number;
    rawData: Record<string, unknown>;
    normalizedData: Record<string, unknown>;
  }[];
  errors: string[];
}) {
  const db = getDb();
  const [batch] = await db
    .insert(importBatches)
    .values({
      fileName: input.fileName,
      sheetName: input.sheetName,
      importType: input.importType,
      detectedType: input.importType,
      status: input.errors.length ? "failed" : "completed",
      rowCount: input.rows.length + input.errors.length,
      successCount: input.rows.length,
      errorCount: input.errors.length,
      resultSummary: { rows: input.rows.length, errors: input.errors },
      errorMessage: input.errors[0] ?? null,
      importedBy: input.importedBy,
    })
    .returning();

  for (const row of input.rows) {
    const created = await createGenericRow(input.importType, row.normalizedData);
    await db.insert(importRows).values({
      batchId: batch.id,
      targetTable:
        input.importType === "projects"
          ? "projects"
          : input.importType === "tax-invoices"
            ? "tax_invoices"
            : "bank_transactions",
      targetId: "id" in created ? String(created.id) : null,
      sheetName: row.sheetName,
      sourceRowNumber: row.sourceRowNumber,
      status: "imported",
      rawData: { rawData: row.rawData, normalizedData: row.normalizedData },
    });
  }

  for (const [index, message] of input.errors.entries()) {
    await db.insert(importRows).values({
      batchId: batch.id,
      sheetName: input.sheetName,
      sourceRowNumber: index,
      status: "error",
      errorMessage: message,
      rawData: { message },
    });
  }

  return batch;
}

export function buildDefaultPermissions() {
  return (["admin", "employee"] as AppUserRole[]).flatMap((role) =>
    ERP_MENUS.map((menu) => ({
      id: `${role}:${menu.key}`,
      role,
      menuKey: menu.key,
      canView:
        role === "admin" ||
        menu.key === "dashboard" ||
        menu.key === "board" ||
        menu.key === "calendar" ||
        menu.key === "work-diaries" ||
        menu.key === "memos",
      canCreate:
        role === "admin" ||
        menu.key === "board" ||
        menu.key === "calendar" ||
        menu.key === "work-diaries" ||
        menu.key === "memos",
      canUpdate: role === "admin" || menu.key === "work-diaries" || menu.key === "memos",
      canDelete: role === "admin" || menu.key === "work-diaries" || menu.key === "memos",
      canUpload: role === "admin",
      createdAt: null,
      updatedAt: null,
    })),
  );
}

export async function createGenericRow(kind: string, data: Record<string, unknown>) {
  const db = getDb();
  if (kind === "projects") {
    const [row] = await db.insert(projects).values(normalizeProject(data)).returning();
    return row;
  }
  if (kind === "tax-invoices") {
    const [row] = await db.insert(taxInvoices).values(normalizeTaxInvoice(data)).returning();
    return row;
  }
  if (kind === "bank-transactions") {
    const [row] = await db.insert(bankTransactions).values(normalizeBankTransaction(data)).returning();
    return row;
  }
  if (kind === "bank-ledgers") {
    const [row] = await db.insert(bankLedgers).values(normalizeBankLedger(data)).returning();
    return row;
  }
  throw new Error("지원하지 않는 저장 유형입니다.");
}

function normalizeProject(data: Record<string, unknown>) {
  return {
    projectCode: textValue(data.projectCode),
    projectName: textValue(data.projectName) || textValue(data.name) || "미지정 프로젝트",
    clientName: textValue(data.clientName),
    managerName: textValue(data.managerName),
    status: textValue(data.status),
    orderedOn: dateTextValue(data.orderedOn),
    startedOn: dateTextValue(data.startedOn),
    endedOn: dateTextValue(data.endedOn),
    contractAmount: numberValue(data.contractAmount),
    receivedAmount: numberValue(data.receivedAmount),
    spentAmount: numberValue(data.spentAmount),
    profitAmount:
      data.profitAmount == null
        ? numberValue(data.receivedAmount) - numberValue(data.spentAmount)
        : numberValue(data.profitAmount),
    memo: textValue(data.memo),
    rawData: data,
  };
}

function projectImportValues(project: ProjectImportProject, importBatchId: string) {
  return {
    projectName: project.projectName,
    clientName: project.clientName,
    orderedOn: project.orderedOn,
    startedOn: project.orderedOn,
    contractAmount: project.contractAmount,
    receivedAmount: project.receivedAmount,
    spentAmount: project.spentAmount,
    profitAmount: project.profitAmount,
    memo: project.memo,
    sourceSheetName: project.sheetName,
    sourceStartRow: project.sourceStartRow,
    sourceEndRow: project.sourceEndRow,
    sourceTotalRow: project.sourceTotalRow,
    rawData: project.rawData,
    importBatchId,
  };
}

function normalizeProjectWithItemTotals(data: Record<string, unknown>, items: NormalizedProjectItemInput[]) {
  const base = normalizeProject(data);
  const contractAmount = items.reduce((total, item) => total + item.contractAmount, 0);
  const receivedAmount = items.reduce((total, item) => total + item.receivedAmount, 0);
  const spentAmount = items.reduce((total, item) => total + item.spentAmount, 0);
  return {
    ...base,
    contractAmount,
    receivedAmount,
    spentAmount,
    profitAmount: receivedAmount - spentAmount,
  };
}

type NormalizedProjectItemInput = {
  itemType: "contract" | "payment" | "expense" | "memo";
  orderedOn: string | null;
  partnerName: string | null;
  description: string | null;
  contractAmount: number;
  receivedAmount: number;
  spentAmount: number;
  paymentStatus: "unpaid" | "paid" | null;
  paymentDate: string | null;
  memo: string | null;
  sourceSheetName: string | null;
  sourceRowNumber: number;
  sortOrder: number;
};

function normalizeProjectItemsInput(value: unknown): NormalizedProjectItemInput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index) => normalizeProjectItemInput(item, index))
    .filter((item) => {
      return (
        item.description ||
        item.partnerName ||
        item.memo ||
        item.contractAmount ||
        item.receivedAmount ||
        item.spentAmount
      );
    });
}

function normalizeProjectItemInput(value: unknown, index: number): NormalizedProjectItemInput {
  const input = isRecord(value) ? (value as ProjectItemInput) : {};
  const itemType = normalizeProjectItemType(input.itemType);
  return {
    itemType,
    orderedOn: dateTextValue(input.orderedOn),
    partnerName: textValue(input.partnerName),
    description: textValue(input.description),
    contractAmount: numberValue(input.contractAmount),
    receivedAmount: numberValue(input.receivedAmount),
    spentAmount: numberValue(input.spentAmount),
    paymentStatus: itemType === "payment" ? normalizePaymentStatus(input.paymentStatus) : null,
    paymentDate: itemType === "payment" ? dateTextValue(input.paymentDate) : null,
    memo: textValue(input.memo),
    sourceSheetName: textValue(input.sourceSheetName),
    sourceRowNumber: numberValue(input.sourceRowNumber) || index + 1,
    sortOrder: numberValue(input.sortOrder) || index,
  };
}

function toProjectItemRows(
  projectId: string,
  items: NormalizedProjectItemInput[],
  fallbackSheetName: string,
) {
  return items.map((item, index) => ({
    projectId,
    itemType: item.itemType,
    sourceSheetName: item.sourceSheetName ?? fallbackSheetName,
    sourceRowNumber: item.sourceRowNumber,
    sortOrder: item.sortOrder || index,
    orderedOn: item.orderedOn,
    partnerName: item.partnerName,
    description: item.description,
    contractAmount: item.contractAmount,
    receivedAmount: item.receivedAmount,
    spentAmount: item.spentAmount,
    memo: item.memo,
    rawData: item,
  }));
}

function normalizeProjectItemType(value: unknown): NormalizedProjectItemInput["itemType"] {
  const text = textValue(value);
  if (text === "contract" || text === "payment" || text === "expense" || text === "memo") {
    return text;
  }
  return "memo";
}

function normalizePaymentStatus(value: unknown): NormalizedProjectItemInput["paymentStatus"] {
  const text = textValue(value);
  if (text === "paid" || text === "결제완료") {
    return "paid";
  }
  if (text === "unpaid" || text === "미결제") {
    return "unpaid";
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTaxInvoice(data: Record<string, unknown>) {
  const supplyAmount = numberValue(data.supplyAmount);
  const taxAmount = numberValue(data.taxAmount);
  return {
    direction: textValue(data.direction) || "sales",
    projectName: textValue(data.projectName),
    partnerName: textValue(data.partnerName) || textValue(data.clientName),
    itemName: textValue(data.itemName),
    supplyAmount,
    taxAmount,
    totalAmount: numberValue(data.totalAmount) || supplyAmount + taxAmount,
    status: textValue(data.status),
    memo: textValue(data.memo),
    rawData: data,
  };
}

function normalizeBankTransaction(data: Record<string, unknown>) {
  return {
    bankName: textValue(data.bankName),
    accountNumber: textValue(data.accountNumber),
    description: textValue(data.description) || textValue(data.title),
    depositAmount: numberValue(data.depositAmount),
    withdrawalAmount: numberValue(data.withdrawalAmount),
    balanceAmount: numberValue(data.balanceAmount),
    category: textValue(data.category),
    memo: textValue(data.memo),
    rawData: data,
  };
}

function normalizeBankLedger(data: Record<string, unknown>) {
  return {
    title: textValue(data.title) || textValue(data.description) || "장부 항목",
    accountName: textValue(data.accountName),
    incomeAmount: numberValue(data.incomeAmount),
    expenseAmount: numberValue(data.expenseAmount),
    balanceAmount: numberValue(data.balanceAmount),
    memo: textValue(data.memo),
    rawData: data,
  };
}

function textValue(value: unknown) {
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
  const text = textValue(value);
  if (!text) {
    return 0;
  }
  const number = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function dateTextValue(value: unknown) {
  const text = textValue(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
