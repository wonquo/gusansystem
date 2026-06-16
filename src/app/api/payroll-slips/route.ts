import { NextResponse } from "next/server";
import { deletePayrollSlip, listPayrollSlips } from "@/lib/erp/data";
import { jsonError, requireErpPermission } from "@/lib/erp/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userGuard = await requireErpPermission("my-payroll", "view");
  if (userGuard.response) return userGuard.response;
  const mode =
    searchParams.get("mode") === "mine" || userGuard.user.role !== "admin"
      ? "my-payroll"
      : "payroll";
  const guard = await requireErpPermission(mode, "view");
  if (guard.response) return guard.response;
  return NextResponse.json({
    rows: await listPayrollSlips({
      currentUserId: guard.user.id,
      role: guard.user.role,
      payrollMonth: searchParams.get("payrollMonth"),
      payrollYear: searchParams.get("payrollYear"),
      payrollMonthNumber: searchParams.get("payrollMonthNumber"),
      employeeName: searchParams.get("employeeName"),
      query: searchParams.get("query"),
      scope: mode === "my-payroll" ? "mine" : "all",
    }),
  });
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireErpPermission("payroll", "delete");
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "급여명세서 ID가 필요합니다." }, { status: 400 });
    }

    await deletePayrollSlip(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "급여명세서를 삭제하지 못했습니다.");
  }
}
