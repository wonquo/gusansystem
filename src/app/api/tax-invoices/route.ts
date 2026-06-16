import { NextResponse } from "next/server";
import { createGenericRow, listTaxInvoices } from "@/lib/erp/data";
import { jsonError, requireErpPermission } from "@/lib/erp/api";

export async function GET(request: Request) {
  const guard = await requireErpPermission("tax-invoices", "view");
  if (guard.response) return guard.response;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({ rows: await listTaxInvoices({ query: searchParams.get("query") }) });
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("tax-invoices", "create");
    if (guard.response) return guard.response;
    const row = await createGenericRow("tax-invoices", await request.json());
    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

