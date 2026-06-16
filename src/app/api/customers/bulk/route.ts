import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCustomers, getCurrentAppUser } from "@/lib/auth";
import { bulkUpdateCustomers, deleteCustomers } from "@/lib/customers";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.string().optional(),
  tag: z.string().trim().min(1).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = bulkSchema.parse(await request.json());
    const result = await bulkUpdateCustomers(body);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || !canManageCustomers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = z.object({ ids: z.array(z.string()).min(1) }).parse(await request.json());
    const result = await deleteCustomers(body.ids);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
