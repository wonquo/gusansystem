import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/db";
import { parseGenericWorkbook } from "@/lib/erp/generic-import";
import { parsePayrollWorkbook } from "@/lib/erp/payroll-import";
import { parseProjectWorkbook } from "@/lib/erp/project-import";
import { decryptWorkbookBuffer, WorkbookDecryptionError } from "@/lib/erp/excel-decryption";
import {
  listImportBatches,
  saveGenericRowsImport,
  savePayrollImport,
  saveProjectImport,
  saveUnsupportedImport,
} from "@/lib/erp/data";
import { jsonError, requireErpPermission } from "@/lib/erp/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ type: string }>;
};

export async function GET() {
  const guard = await requireErpPermission("imports", "view");
  if (guard.response) return guard.response;
  return NextResponse.json({ rows: await listImportBatches() });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { type } = await context.params;
    const menuKey =
      type === "payroll-slips"
        ? "payroll"
        : type === "projects"
          ? "projects"
          : type === "tax-invoices"
            ? "tax-invoices"
            : type === "bank-transactions"
              ? "bank"
              : "imports";
    const guard = await requireErpPermission(menuKey, "upload");
    if (guard.response) return guard.response;

    const formData = await request.formData();
    const action = String(formData.get("action") ?? "commit");
    const file = formData.get("file");
    const password = String(formData.get("password") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "엑셀 파일을 선택해주세요." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        {
          error:
            ".xlsx 파일만 자동 파싱할 수 있습니다. .xls 파일은 엑셀에서 xlsx로 다시 저장한 뒤 업로드해 주세요.",
        },
        { status: 400 },
      );
    }

    const uploadedBuffer = await file.arrayBuffer();
    let buffer = uploadedBuffer;
    if (password) {
      try {
        buffer = await decryptWorkbookBuffer(uploadedBuffer, password);
      } catch (error) {
        if (error instanceof WorkbookDecryptionError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    if (type !== "payroll-slips" && type !== "auto") {
      if (type === "projects") {
        const result = await parseProjectWorkbook(buffer);
        const previewRows = result.projects.slice(0, 50).map((project) => ({
          sourceSheetName: project.sheetName,
          sourceStartRow: project.sourceStartRow,
          sourceTotalRow: project.sourceTotalRow,
          projectName: project.projectName,
          clientName: project.clientName,
          orderedOn: project.orderedOn,
          contractAmount: project.contractAmount,
          receivedAmount: project.receivedAmount,
          spentAmount: project.spentAmount,
          profitAmount: project.profitAmount,
          itemCount: project.items.length,
        }));
        if (action === "preview" || !hasDatabaseUrl()) {
          return NextResponse.json({
            fileName: file.name,
            detectedType: result.detectedType,
            sheets: result.sheets,
            previewRows,
            errors: result.errors.map((error) => ({ message: error.message })),
            canCommit: Boolean(hasDatabaseUrl() && result.projects.length),
          });
        }
        const batch = await saveProjectImport({
          fileName: file.name,
          importType: type,
          sheetName: result.sheets[0] ?? "Workbook",
          importedBy: guard.user.id,
          projects: result.projects,
          errors: result.errors,
        });
        return NextResponse.json({
          batch,
          detectedType: result.detectedType,
          sheets: result.sheets,
          previewRows,
          errors: result.errors.map((error) => ({ message: error.message })),
        });
      }

      if (["tax-invoices", "bank-transactions"].includes(type)) {
        const result = await parseGenericWorkbook(buffer, type);
        const previewRows = result.rows.slice(0, 50).map((row) => ({
          sourceRowNumber: row.sourceRowNumber,
          ...row.normalizedData,
        }));
        if (action === "preview" || !hasDatabaseUrl()) {
          return NextResponse.json({
            fileName: file.name,
            detectedType: type,
            sheets: [result.sheetName],
            previewRows,
            errors: result.errors.map((message) => ({ message })),
            canCommit: Boolean(hasDatabaseUrl() && result.rows.length),
          });
        }
        const batch = await saveGenericRowsImport({
          fileName: file.name,
          importType: type,
          sheetName: result.sheetName,
          importedBy: guard.user.id,
          rows: result.rows,
          errors: result.errors,
        });
        return NextResponse.json({
          batch,
          detectedType: type,
          sheets: [result.sheetName],
          previewRows,
          errors: result.errors.map((message) => ({ message })),
        });
      }

      const message = "지원하지 않는 엑셀 유형입니다.";
      if (action !== "preview" && hasDatabaseUrl()) {
        const batch = await saveUnsupportedImport({
          fileName: file.name,
          importType: type,
          sheetName: "Workbook",
          importedBy: guard.user.id,
          message,
          rawData: { fileName: file.name, type },
        });
        return NextResponse.json({
          batch,
          detectedType: type,
          previewRows: [],
          errors: [{ message }],
        });
      }
      return NextResponse.json({
        detectedType: type,
        previewRows: [],
        errors: [{ message }],
      });
    }

    const result = await parsePayrollWorkbook(buffer);
    const previewRows = result.slips.map((slip) => ({
      employeeCode: slip.employeeCode,
      employeeName: slip.employeeName,
      position: slip.position,
      payrollMonth: slip.payrollMonth,
      grossPay: slip.grossPay,
      totalDeduction: slip.totalDeduction,
      netPay: slip.netPay,
      itemCount: slip.items.length,
      sourceSheetName: slip.sourceSheetName,
      sourceBlock: slip.sourceBlock,
    }));

    if (action === "preview" || !hasDatabaseUrl()) {
      return NextResponse.json({
        fileName: file.name,
        detectedType: result.detectedType,
        sheets: result.sheets,
        previewRows,
        errors: result.errors,
        canCommit: Boolean(hasDatabaseUrl() && result.slips.length),
      });
    }

    const batch = await savePayrollImport({
      fileName: file.name,
      importType: "payroll-slips",
      sheetName: result.sheets[0] ?? "Workbook",
      importedBy: guard.user.id,
      slips: result.slips,
      errors: result.errors,
    });

    return NextResponse.json({
      batch,
      fileName: file.name,
      detectedType: result.detectedType,
      sheets: result.sheets,
      previewRows,
      errors: result.errors,
    });
  } catch (error) {
    return jsonError(error, "엑셀 업로드에 실패했습니다.");
  }
}
