import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCustomers, getCurrentAppUser } from "@/lib/auth";
import { createCustomerOption, renameCustomerOptionValue } from "@/lib/customer-options";

const createSchema = z.object({
  type: z.enum(["source", "status"]),
  label: z.string().trim().min(1),
});

const renameValueSchema = z
  .object({
    type: z.enum(["source", "status"]),
    fromLabel: z.string().trim().min(1),
    label: z.string().trim().min(1),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = createSchema.parse(await request.json());
    const option = await createCustomerOption(body);

    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = renameValueSchema.parse(await request.json());
    const option = await renameCustomerOptionValue(body);

    return NextResponse.json({ option });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
