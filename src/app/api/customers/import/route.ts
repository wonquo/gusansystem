import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { canManageCustomers, getCurrentAppUser } from "@/lib/auth";
import { getCustomerFacets, importCustomers, listCustomerPage } from "@/lib/customers";
import { parseCustomerSheet } from "@/lib/customer-import";

export const runtime = "nodejs";

const TEMPLATE_FILE_NAME = "customer-import-template.xlsx";
const TEMPLATE_HEADERS = [
  "DB출처",
  "전화번호",
  "성별/연령대",
  "상황",
  "고객 메모",
  "마지막 통화",
  "오더 특이사항",
  "비고",
] as const;

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CRM";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Sheet1");
    sheet.mergeCells("A1:H1");
    sheet.getCell("A1").value = "고객 엑셀 업로드 템플릿";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.getCell("A1").alignment = { vertical: "middle" };
    sheet.getCell("A3").value = "5행은 헤더입니다. 실제 고객 데이터는 6행부터 입력해주세요.";
    sheet.getCell("A4").value = "전화번호는 필수이며, 같은 전화번호는 업로드 시 한 고객으로 병합됩니다.";
    sheet.getRow(5).values = [...TEMPLATE_HEADERS];
    sheet.getRow(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(5).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(5).height = 22;
    sheet.getRow(5).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4F9F" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFBFD2F5" } },
        left: { style: "thin", color: { argb: "FFBFD2F5" } },
        bottom: { style: "thin", color: { argb: "FFBFD2F5" } },
        right: { style: "thin", color: { argb: "FFBFD2F5" } },
      };
    });
    sheet.views = [{ state: "frozen", ySplit: 5 }];
    sheet.columns = [
      { key: "source", width: 18 },
      { key: "phone", width: 18 },
      { key: "genderAge", width: 14 },
      { key: "status", width: 16 },
      { key: "callNote", width: 28 },
      { key: "lastContacted", width: 16 },
      { key: "orderNote", width: 28 },
      { key: "remark", width: 28 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${TEMPLATE_FILE_NAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "엑셀 템플릿 생성에 실패했습니다." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "엑셀 파일을 선택해주세요." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "xlsx 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.getWorksheet("Sheet1");
    if (!sheet) {
      return NextResponse.json({ error: "Sheet1 시트를 찾을 수 없습니다." }, { status: 400 });
    }

    const rows = parseCustomerSheet(sheet);
    if (!rows.length) {
      return NextResponse.json(
        { error: "Sheet1에서 업로드할 고객 전화번호를 찾지 못했습니다." },
        { status: 400 },
      );
    }

    const result = await importCustomers({
      fileName: file.name,
      sheetName: sheet.name,
      rows,
      importedBy: user.id,
    });
    const [latestPage, facets] = await Promise.all([
      listCustomerPage(user.id, { page: 1, pageSize: 100 }),
      getCustomerFacets(undefined, user.id),
    ]);

    return NextResponse.json({
      ...result,
      sheetName: sheet.name,
      fileName: file.name,
      parsedRows: rows.length,
      sourceRows: Math.max(rows[rows.length - 1].sourceRowNumber - 5, 0),
      rows: latestPage.rows,
      pageInfo: latestPage.pageInfo,
      facets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "엑셀 업로드에 실패했습니다." },
      { status: 400 },
    );
  }
}
