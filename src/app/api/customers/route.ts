import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCustomers, getCurrentAppUser } from "@/lib/auth";
import { createCustomer, listCustomerPage } from "@/lib/customers";
import type { CustomerDashboardFilter, CustomerSortKey } from "@/lib/types";

const sortKeys = [
  "source",
  "salesPotential",
  "phone",
  "gender",
  "ageDecade",
  "status",
  "lastContacted",
  "callNote",
  "orderNote",
  "remark",
] as const satisfies readonly CustomerSortKey[];
const dashboardFilters = ["open", "callbacks", "contacted"] as const satisfies readonly CustomerDashboardFilter[];

const createSchema = z
  .object({
    source: z.string().optional(),
    salesPotential: z.string().nullable().optional(),
    phone: z.string().optional(),
    gender: z.string().nullable().optional(),
    ageDecade: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    callNote: z.string().nullable().optional(),
    lastContactedAt: z.string().datetime().nullable().optional(),
    lastContactedLabel: z.string().nullable().optional(),
    orderNote: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const sortKey = searchParams.get("sortKey");
    const sortDirection = searchParams.get("sortDirection");
    const result = await listCustomerPage(user.id, {
      page: parseNumber(searchParams.get("page")),
      pageSize: parsePageSize(searchParams.get("pageSize")),
      query: searchParams.get("query") ?? "",
      source: normalizeFacet(searchParams.get("source")),
      salesPotential: normalizeFacet(searchParams.get("salesPotential")),
      status: normalizeFacet(searchParams.get("status")),
      gender: normalizeFacet(searchParams.get("gender")),
      ageDecade: normalizeFacet(searchParams.get("ageDecade")),
      dashboardFilter: parseDashboardFilter(searchParams.get("dashboardFilter")),
      sortKey: sortKeys.includes(sortKey as CustomerSortKey)
        ? (sortKey as CustomerSortKey)
        : null,
      sortDirection: sortDirection === "desc" ? "desc" : "asc",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
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

    const body = createSchema.parse(await request.json());
    const customer = await createCustomer({ ...body, assignedUserId: user.id });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePageSize(value: string | null) {
  if (value === "all") return "all";
  return parseNumber(value);
}

function normalizeFacet(value: string | null) {
  if (!value || value === "__all__") return null;
  return value;
}

function parseDashboardFilter(value: string | null) {
  return dashboardFilters.includes(value as CustomerDashboardFilter)
    ? (value as CustomerDashboardFilter)
    : null;
}
