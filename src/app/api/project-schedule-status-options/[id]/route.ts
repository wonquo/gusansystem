import { NextResponse } from "next/server";
import { z } from "zod";
import { requireErpPermission } from "@/lib/erp/api";
import {
  deleteProjectScheduleStatusOption,
  updateProjectScheduleStatusOption,
} from "@/lib/project-schedule-status-options";

const updateSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    color: z.string().trim().regex(/^#[0-9a-f]{6}$/i).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireErpPermission("project-schedules", "update");
    if (guard.response) return guard.response;
    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());
    const option = await updateProjectScheduleStatusOption(id, body);
    return NextResponse.json({ option });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireErpPermission("project-schedules", "update");
    if (guard.response) return guard.response;
    const { id } = await context.params;
    await deleteProjectScheduleStatusOption(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
