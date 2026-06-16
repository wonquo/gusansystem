import path from "node:path";
import { config } from "dotenv";
import ExcelJS from "exceljs";
import { getDb, hasDatabaseUrl } from "@/db";
import { customerImportRows, customers, importBatches } from "@/db/schema";
import { parseCustomerSheet } from "@/lib/customer-import";

config({ path: ".env.local" });
config();

async function main() {
  const inputPath = process.env.IMPORT_XLSX_PATH;
  const importYear = Number(process.env.IMPORT_YEAR ?? new Date().getFullYear());

  if (!inputPath) {
    throw new Error("IMPORT_XLSX_PATH is required.");
  }

  if (!hasDatabaseUrl()) {
    throw new Error("DATABASE_URL is required to import customers.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);
  const sheet = workbook.getWorksheet("Sheet1");
  if (!sheet) {
    throw new Error("Sheet1 was not found in the workbook.");
  }

  const rows = parseCustomerSheet(sheet, importYear);
  const db = getDb();

  if (process.env.CLEAR_EXISTING_CUSTOMERS === "true") {
    await db.delete(customerImportRows);
    await db.delete(importBatches);
    await db.delete(customers);
  }

  const [batch] = await db
    .insert(importBatches)
    .values({
      fileName: path.basename(inputPath),
      sheetName: "Sheet1",
      rowCount: rows.length,
    })
    .returning();

  let inserted = 0;
  const chunkSize = 500;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const insertedCustomers = await db
      .insert(customers)
      .values(chunk.map((row) => ({
        source: row.source ?? "미분류",
        phone: row.phone,
        gender: row.gender,
        ageDecade: row.ageDecade,
        status: row.status,
        callNote: row.callNote,
        lastContactedAt: row.lastContactedAt,
        lastContactedLabel: row.lastContactedLabel,
        orderNote: row.orderNote,
        remark: row.remark,
      })))
      .returning();

    await db.insert(customerImportRows).values(
      insertedCustomers.map((customer, customerIndex) => ({
        batchId: batch.id,
        customerId: customer.id,
        sourceRowNumber: chunk[customerIndex].sourceRowNumber,
        rawData: chunk[customerIndex].rawData,
      })),
    );

    inserted += insertedCustomers.length;
    console.log(`Imported ${inserted}/${rows.length} customers...`);
  }

  console.log(`Imported ${inserted} customers from ${path.basename(inputPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
