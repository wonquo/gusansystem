import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import {
  deleteWorkDiaryType,
  updateWorkDiaryType,
} from "@/lib/work-diaries";

const updateSchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
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
    if (guard.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = updateSchema.parse(await request.json());
    const option = await updateWorkDiaryType(id, body);

    return NextResponse.json({ option });
  } catch (error) {
    return jsonError(error, "업무구분을 수정하지 못했습니다.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireErpPermission("work-diaries", "delete");
    if (guard.response) return guard.response;
    if (guard.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const result = await deleteWorkDiaryType(id);

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "업무구분을 삭제하지 못했습니다.");
  }
}
