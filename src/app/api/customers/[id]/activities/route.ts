import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCustomers, getCurrentAppUser } from "@/lib/auth";
import {
  listCustomerContactActivities,
  replaceCustomerContactActivities,
} from "@/lib/customers";

const activitySchema = z.object({
  method: z.enum(["call", "sms"]),
  occurredAt: z.string().min(1),
  note: z.string().nullable().optional(),
});

const updateSchema = z
  .object({
    activities: z.array(activitySchema).max(200),
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
    const activities = await listCustomerContactActivities(id);

    return NextResponse.json({ activities });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function PUT(
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
    const result = await replaceCustomerContactActivities({
      customerId: id,
      createdBy: user.id,
      activities: body.activities,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
