import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCustomers, getCurrentAppUser } from "@/lib/auth";
import { getCustomerById, updateCustomer } from "@/lib/customers";

const updateSchema = z
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const customer = await getCustomerById(id, user.id);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());
    const customer = await updateCustomer(id, body);

    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
