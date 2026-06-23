import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "employee"]);
export const userStatusEnum = pgEnum("user_status", ["active", "invited", "disabled"]);
export const customerOptionTypeEnum = pgEnum("customer_option_type", ["source", "status"]);
export const employeeStatusEnum = pgEnum("employee_status", ["active", "inactive"]);
export const importStatusEnum = pgEnum("import_status", ["previewed", "completed", "failed"]);
export const projectItemTypeEnum = pgEnum("project_item_type", [
  "contract",
  "payment",
  "expense",
  "memo",
]);

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loginId: text("login_id").notNull(),
    passwordHash: text("password_hash").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    profileImageUrl: text("profile_image_url"),
    role: userRoleEnum("role").notNull().default("employee"),
    status: userStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("app_users_login_id_idx").on(table.loginId),
    uniqueIndex("app_users_email_idx").on(table.email),
  ],
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeCode: text("employee_code"),
    name: text("name").notNull(),
    position: text("position"),
    department: text("department"),
    payrollBankAccount: text("payroll_bank_account"),
    userId: uuid("user_id").references(() => appUsers.id, { onDelete: "set null" }),
    status: employeeStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("employees_employee_code_idx").on(table.employeeCode),
    index("employees_user_idx").on(table.userId),
    index("employees_name_idx").on(table.name),
  ],
);

export const menuPermissions = pgTable(
  "menu_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: userRoleEnum("role").notNull(),
    menuKey: text("menu_key").notNull(),
    canView: boolean("can_view").notNull().default(false),
    canCreate: boolean("can_create").notNull().default(false),
    canUpdate: boolean("can_update").notNull().default(false),
    canDelete: boolean("can_delete").notNull().default(false),
    canUpload: boolean("can_upload").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("menu_permissions_role_menu_idx").on(table.role, table.menuKey),
    index("menu_permissions_menu_idx").on(table.menuKey),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectCode: text("project_code"),
    projectName: text("project_name").notNull(),
    clientName: text("client_name"),
    managerName: text("manager_name"),
    status: text("status"),
    orderedOn: date("ordered_on"),
    startedOn: date("started_on"),
    endedOn: date("ended_on"),
    contractAmount: integer("contract_amount").notNull().default(0),
    receivedAmount: integer("received_amount").notNull().default(0),
    spentAmount: integer("spent_amount").notNull().default(0),
    profitAmount: integer("profit_amount").notNull().default(0),
    memo: text("memo"),
    sourceSheetName: text("source_sheet_name"),
    sourceStartRow: integer("source_start_row"),
    sourceEndRow: integer("source_end_row"),
    sourceTotalRow: integer("source_total_row"),
    rawData: jsonb("raw_data").notNull().default({}),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("projects_name_idx").on(table.projectName),
    index("projects_status_idx").on(table.status),
    index("projects_ordered_idx").on(table.orderedOn),
    index("projects_import_batch_idx").on(table.importBatchId),
    uniqueIndex("projects_source_block_idx").on(
      table.sourceSheetName,
      table.sourceStartRow,
      table.sourceTotalRow,
    ),
  ],
);

export const projectItems = pgTable(
  "project_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    itemType: projectItemTypeEnum("item_type").notNull(),
    sourceSheetName: text("source_sheet_name").notNull(),
    sourceRowNumber: integer("source_row_number").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    orderedOn: date("ordered_on"),
    partnerName: text("partner_name"),
    description: text("description"),
    contractAmount: integer("contract_amount").notNull().default(0),
    receivedAmount: integer("received_amount").notNull().default(0),
    spentAmount: integer("spent_amount").notNull().default(0),
    memo: text("memo"),
    rawData: jsonb("raw_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_items_project_idx").on(table.projectId),
    index("project_items_type_idx").on(table.itemType),
    uniqueIndex("project_items_source_row_idx").on(
      table.projectId,
      table.sourceSheetName,
      table.sourceRowNumber,
    ),
  ],
);

export const taxInvoices = pgTable(
  "tax_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issuedOn: date("issued_on"),
    direction: text("direction").notNull().default("sales"),
    projectName: text("project_name"),
    partnerName: text("partner_name"),
    itemName: text("item_name"),
    supplyAmount: integer("supply_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    status: text("status"),
    memo: text("memo"),
    rawData: jsonb("raw_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("tax_invoices_issued_idx").on(table.issuedOn),
    index("tax_invoices_partner_idx").on(table.partnerName),
  ],
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactedOn: date("transacted_on"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    description: text("description"),
    depositAmount: integer("deposit_amount").notNull().default(0),
    withdrawalAmount: integer("withdrawal_amount").notNull().default(0),
    balanceAmount: integer("balance_amount").notNull().default(0),
    category: text("category"),
    memo: text("memo"),
    rawData: jsonb("raw_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bank_transactions_date_idx").on(table.transactedOn),
    index("bank_transactions_description_idx").on(table.description),
  ],
);

export const bankLedgers = pgTable(
  "bank_ledgers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ledgerDate: date("ledger_date"),
    title: text("title").notNull(),
    accountName: text("account_name"),
    incomeAmount: integer("income_amount").notNull().default(0),
    expenseAmount: integer("expense_amount").notNull().default(0),
    balanceAmount: integer("balance_amount").notNull().default(0),
    memo: text("memo"),
    rawData: jsonb("raw_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bank_ledgers_date_idx").on(table.ledgerDate),
    index("bank_ledgers_title_idx").on(table.title),
  ],
);

export const payrollSlips = pgTable(
  "payroll_slips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    employeeCode: text("employee_code"),
    employeeName: text("employee_name").notNull(),
    position: text("position"),
    payrollMonth: text("payroll_month").notNull(),
    payrollBankAccount: text("payroll_bank_account"),
    grossPay: integer("gross_pay").notNull().default(0),
    totalDeduction: integer("total_deduction").notNull().default(0),
    netPay: integer("net_pay").notNull().default(0),
    sourceSheetName: text("source_sheet_name").notNull(),
    sourceBlock: text("source_block"),
    rawData: jsonb("raw_data").notNull().default({}),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payroll_slips_employee_idx").on(table.employeeId),
    index("payroll_slips_month_idx").on(table.payrollMonth),
    index("payroll_slips_employee_month_idx").on(table.employeeName, table.payrollMonth),
  ],
);

export const payrollItems = pgTable(
  "payroll_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payrollSlipId: uuid("payroll_slip_id")
      .notNull()
      .references(() => payrollSlips.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    label: text("label").notNull(),
    amount: integer("amount").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    rawData: jsonb("raw_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payroll_items_slip_idx").on(table.payrollSlipId),
    index("payroll_items_type_idx").on(table.itemType),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull().default(""),
    salesPotential: text("sales_potential"),
    phone: text("phone").notNull(),
    gender: text("gender"),
    ageDecade: text("age_decade"),
    status: text("status"),
    callNote: text("call_note"),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    lastContactedLabel: text("last_contacted_label"),
    orderNote: text("order_note"),
    remark: text("remark"),
    tags: text("tags").array().notNull().default([]),
    assignedUserId: uuid("assigned_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("customers_phone_idx").on(table.phone),
    index("customers_source_idx").on(table.source),
    index("customers_sales_potential_idx").on(table.salesPotential),
    index("customers_status_idx").on(table.status),
    index("customers_assigned_user_idx").on(table.assignedUserId),
    index("customers_assigned_updated_idx").on(table.assignedUserId, table.updatedAt),
    index("customers_assigned_updated_id_desc_idx").on(
      table.assignedUserId,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index("customers_assigned_source_updated_idx").on(
      table.assignedUserId,
      table.source,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index("customers_assigned_sales_potential_updated_idx").on(
      table.assignedUserId,
      table.salesPotential,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index("customers_assigned_status_updated_idx").on(
      table.assignedUserId,
      table.status,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index("customers_assigned_gender_updated_idx").on(
      table.assignedUserId,
      table.gender,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index("customers_assigned_age_updated_idx").on(
      table.assignedUserId,
      table.ageDecade,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const customerOptions = pgTable(
  "customer_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: customerOptionTypeEnum("type").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customer_options_type_label_idx").on(table.type, table.label),
    index("customer_options_type_sort_idx").on(table.type, table.sortOrder),
  ],
);

export const customerActivities = pgTable(
  "customer_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("customer_activities_customer_idx").on(table.customerId),
    index("customer_activities_occurred_idx").on(table.occurredAt),
  ],
);

export const notices = pgTable(
  "notices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    popupEnabled: boolean("popup_enabled").notNull().default(false),
    popupStartsAt: timestamp("popup_starts_at", { withTimezone: true }),
    popupEndsAt: timestamp("popup_ends_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notices_pinned_created_idx").on(table.isPinned, table.createdAt),
    index("notices_popup_idx").on(table.popupEnabled, table.popupStartsAt, table.popupEndsAt),
  ],
);

export const boardPosts = pgTable(
  "board_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull().default("일반"),
    attachments: jsonb("attachments").notNull().default([]),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("board_posts_category_idx").on(table.category),
    index("board_posts_created_idx").on(table.createdAt),
  ],
);

export const boardComments = pgTable(
  "board_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => boardPosts.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    attachments: jsonb("attachments").notNull().default([]),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("board_comments_post_idx").on(table.postId),
    index("board_comments_created_idx").on(table.createdAt),
  ],
);

export const memos = pgTable(
  "memos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    attachments: jsonb("attachments").notNull().default([]),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("memos_title_idx").on(table.title),
    index("memos_created_idx").on(table.createdAt),
    index("memos_updated_idx").on(table.updatedAt),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    position: text("position").notNull().default(""),
    company: text("company").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    task: text("task").notNull().default(""),
    memo: text("memo").notNull().default(""),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("contacts_name_idx").on(table.name),
    index("contacts_company_idx").on(table.company),
    index("contacts_phone_idx").on(table.phone),
    index("contacts_email_idx").on(table.email),
    index("contacts_updated_idx").on(table.updatedAt),
  ],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull().default("기타"),
    eventDate: date("event_date").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    allDay: boolean("all_day").notNull().default(true),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    location: text("location"),
    note: text("note"),
    attendees: jsonb("attendees").notNull().default([]),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("calendar_events_date_idx").on(table.eventDate),
    index("calendar_events_range_idx").on(table.startDate, table.endDate),
    index("calendar_events_category_idx").on(table.category),
    index("calendar_events_created_idx").on(table.createdAt),
  ],
);

export const workDiaryDestinations = pgTable(
  "work_diary_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("work_diary_destinations_code_idx").on(table.code),
    index("work_diary_destinations_active_sort_idx").on(table.isActive, table.sortOrder),
  ],
);

export const workDiaryTypes = pgTable(
  "work_diary_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    color: text("color").notNull().default("#475569"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("work_diary_types_code_idx").on(table.code),
    index("work_diary_types_active_sort_idx").on(table.isActive, table.sortOrder),
  ],
);

export const workDiaryEntries = pgTable(
  "work_diary_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    workType: text("work_type").notNull().default("업무"),
    workTypeId: uuid("work_type_id").references(() => workDiaryTypes.id, {
      onDelete: "set null",
    }),
    primaryWork: text("primary_work").notNull().default(""),
    secondaryWork: text("secondary_work").notNull().default(""),
    destinationId: uuid("destination_id").references(() => workDiaryDestinations.id, {
      onDelete: "set null",
    }),
    memo: text("memo").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("work_diary_entries_user_date_unique_idx").on(table.userId, table.workDate),
    index("work_diary_entries_user_date_idx").on(table.userId, table.workDate),
    index("work_diary_entries_date_idx").on(table.workDate),
    index("work_diary_entries_type_idx").on(table.workTypeId),
    index("work_diary_entries_destination_idx").on(table.destinationId),
  ],
);

export const noticeComments = pgTable(
  "notice_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notice_comments_notice_idx").on(table.noticeId),
    index("notice_comments_created_idx").on(table.createdAt),
  ],
);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  sheetName: text("sheet_name").notNull(),
  importType: text("import_type").notNull().default("unknown"),
  detectedType: text("detected_type"),
  status: importStatusEnum("status").notNull().default("completed"),
  rowCount: integer("row_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  resultSummary: jsonb("result_summary").notNull().default({}),
  errorMessage: text("error_message"),
  importedBy: uuid("imported_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    targetTable: text("target_table"),
    targetId: uuid("target_id"),
    sheetName: text("sheet_name").notNull(),
    sourceRowNumber: integer("source_row_number").notNull().default(0),
    sourceCellRange: text("source_cell_range"),
    status: text("status").notNull().default("imported"),
    errorMessage: text("error_message"),
    rawData: jsonb("raw_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("import_rows_batch_idx").on(table.batchId),
    index("import_rows_target_idx").on(table.targetTable, table.targetId),
  ],
);

export const customerImportRows = pgTable(
  "customer_import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    sourceRowNumber: integer("source_row_number").notNull(),
    rawData: jsonb("raw_data").notNull(),
  },
  (table) => [
    index("customer_import_rows_batch_idx").on(table.batchId),
    index("customer_import_rows_customer_idx").on(table.customerId),
  ],
);

export const appUsersRelations = relations(appUsers, ({ many }) => ({
  employees: many(employees),
  importBatches: many(importBatches),
  assignedCustomers: many(customers),
  activities: many(customerActivities),
  notices: many(notices),
  noticeComments: many(noticeComments),
  boardPosts: many(boardPosts),
  boardComments: many(boardComments),
  memos: many(memos),
  contacts: many(contacts),
  calendarEvents: many(calendarEvents),
  workDiaryEntries: many(workDiaryEntries),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(appUsers, {
    fields: [employees.userId],
    references: [appUsers.id],
  }),
  payrollSlips: many(payrollSlips),
}));

export const payrollSlipsRelations = relations(payrollSlips, ({ one, many }) => ({
  employee: one(employees, {
    fields: [payrollSlips.employeeId],
    references: [employees.id],
  }),
  batch: one(importBatches, {
    fields: [payrollSlips.importBatchId],
    references: [importBatches.id],
  }),
  items: many(payrollItems),
}));

export const payrollItemsRelations = relations(payrollItems, ({ one }) => ({
  slip: one(payrollSlips, {
    fields: [payrollItems.payrollSlipId],
    references: [payrollSlips.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  batch: one(importBatches, {
    fields: [projects.importBatchId],
    references: [importBatches.id],
  }),
  items: many(projectItems),
}));

export const projectItemsRelations = relations(projectItems, ({ one }) => ({
  project: one(projects, {
    fields: [projectItems.projectId],
    references: [projects.id],
  }),
}));

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  importer: one(appUsers, {
    fields: [importBatches.importedBy],
    references: [appUsers.id],
  }),
  rows: many(importRows),
  payrollSlips: many(payrollSlips),
  projects: many(projects),
}));

export const importRowsRelations = relations(importRows, ({ one }) => ({
  batch: one(importBatches, {
    fields: [importRows.batchId],
    references: [importBatches.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  assignedUser: one(appUsers, {
    fields: [customers.assignedUserId],
    references: [appUsers.id],
  }),
  activities: many(customerActivities),
}));

export const customerActivitiesRelations = relations(customerActivities, ({ one }) => ({
  customer: one(customers, {
    fields: [customerActivities.customerId],
    references: [customers.id],
  }),
  creator: one(appUsers, {
    fields: [customerActivities.createdBy],
    references: [appUsers.id],
  }),
}));

export const noticesRelations = relations(notices, ({ one, many }) => ({
  author: one(appUsers, {
    fields: [notices.createdBy],
    references: [appUsers.id],
  }),
  comments: many(noticeComments),
}));

export const noticeCommentsRelations = relations(noticeComments, ({ one }) => ({
  notice: one(notices, {
    fields: [noticeComments.noticeId],
    references: [notices.id],
  }),
  author: one(appUsers, {
    fields: [noticeComments.createdBy],
    references: [appUsers.id],
  }),
}));

export const boardPostsRelations = relations(boardPosts, ({ one, many }) => ({
  author: one(appUsers, {
    fields: [boardPosts.createdBy],
    references: [appUsers.id],
  }),
  comments: many(boardComments),
}));

export const boardCommentsRelations = relations(boardComments, ({ one }) => ({
  post: one(boardPosts, {
    fields: [boardComments.postId],
    references: [boardPosts.id],
  }),
  author: one(appUsers, {
    fields: [boardComments.createdBy],
    references: [appUsers.id],
  }),
}));

export const memosRelations = relations(memos, ({ one }) => ({
  author: one(appUsers, {
    fields: [memos.createdBy],
    references: [appUsers.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  author: one(appUsers, {
    fields: [contacts.createdBy],
    references: [appUsers.id],
  }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  author: one(appUsers, {
    fields: [calendarEvents.createdBy],
    references: [appUsers.id],
  }),
}));

export const workDiaryDestinationsRelations = relations(workDiaryDestinations, ({ many }) => ({
  entries: many(workDiaryEntries),
}));

export const workDiaryTypesRelations = relations(workDiaryTypes, ({ many }) => ({
  entries: many(workDiaryEntries),
}));

export const workDiaryEntriesRelations = relations(workDiaryEntries, ({ one }) => ({
  user: one(appUsers, {
    fields: [workDiaryEntries.userId],
    references: [appUsers.id],
  }),
  workTypeOption: one(workDiaryTypes, {
    fields: [workDiaryEntries.workTypeId],
    references: [workDiaryTypes.id],
  }),
  destination: one(workDiaryDestinations, {
    fields: [workDiaryEntries.destinationId],
    references: [workDiaryDestinations.id],
  }),
}));

export type AppUserRole = (typeof userRoleEnum.enumValues)[number];
export type AppUserStatus = (typeof userStatusEnum.enumValues)[number];
export type CustomerOptionType = (typeof customerOptionTypeEnum.enumValues)[number];
export type EmployeeStatus = (typeof employeeStatusEnum.enumValues)[number];
export type ImportStatus = (typeof importStatusEnum.enumValues)[number];
export type ProjectItemType = (typeof projectItemTypeEnum.enumValues)[number];
