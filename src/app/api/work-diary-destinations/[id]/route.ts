import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import {
  deleteWorkDiaryDestination,
  updateWorkDiaryDestination,
} from "@/lib/work-diaries";

const updateSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireErpPermission("work-diaries", "update");
    if (guard.response) return guard.response;

    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());
    const option = await updateWorkDiaryDestination(id, body);

    return NextResponse.json({ option });
  } catch (error) {
    return jsonError(error, "행선지를 수정하지 못했습니다.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireErpPermission("work-diaries", "delete");
    if (guard.response) return guard.response;

    const { id } = await context.params;
    const result = await deleteWorkDiaryDestination(id);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "행선지를 삭제하지 못했습니다.");
  }
}
