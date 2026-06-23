import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import { createMemo, deleteMemo, listMemos, updateMemo } from "@/lib/memos";

const attachmentSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    size: z.number().int().nonnegative(),
    type: z.string().trim(),
    dataUrl: z.string().trim().min(1),
  })
  .strict();

const memoSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1),
    content: z.string().optional().default(""),
    attachments: z.array(attachmentSchema).max(10).optional(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const guard = await requireErpPermission("memos", "view");
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    return NextResponse.json({ rows: await listMemos(searchParams.get("query"), guard.user.id) });
  } catch (error) {
    return jsonError(error, "메모를 조회하지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("memos", "create");
    if (guard.response) return guard.response;

    const input = memoSchema.parse(await request.json());
    const memo = await createMemo(input, guard.user.id);

    return NextResponse.json({ memo }, { status: 201 });
  } catch (error) {
    return jsonError(error, "메모를 등록하지 못했습니다.");
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireErpPermission("memos", "update");
    if (guard.response) return guard.response;

    const input = memoSchema.required({ id: true }).parse(await request.json());
    const memo = await updateMemo(input.id, input, guard.user.id);

    return NextResponse.json({ memo });
  } catch (error) {
    return jsonError(error, "메모를 저장하지 못했습니다.");
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireErpPermission("memos", "delete");
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "메모 ID가 필요합니다." }, { status: 400 });
    }

    await deleteMemo(id, guard.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "메모를 삭제하지 못했습니다.");
  }
}
