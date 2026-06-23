import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import { createContact, deleteContact, listContacts, updateContact } from "@/lib/contacts";

const contactSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1),
    position: z.string().trim().optional().default(""),
    company: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
    email: z.string().trim().optional().default(""),
    task: z.string().trim().optional().default(""),
    memo: z.string().trim().optional().default(""),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const guard = await requireErpPermission("contacts", "view");
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    return NextResponse.json({ rows: await listContacts(searchParams.get("query")) });
  } catch (error) {
    return jsonError(error, "연락처를 조회하지 못했습니다.");
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("contacts", "create");
    if (guard.response) return guard.response;

    const input = contactSchema.parse(await request.json());
    const contact = await createContact(input, guard.user.id);

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return jsonError(error, "연락처를 등록하지 못했습니다.");
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireErpPermission("contacts", "update");
    if (guard.response) return guard.response;

    const input = contactSchema.required({ id: true }).parse(await request.json());
    const contact = await updateContact(input.id, input);

    return NextResponse.json({ contact });
  } catch (error) {
    return jsonError(error, "연락처를 저장하지 못했습니다.");
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireErpPermission("contacts", "delete");
    if (guard.response) return guard.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "연락처 ID가 필요합니다." }, { status: 400 });
    }

    await deleteContact(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "연락처를 삭제하지 못했습니다.");
  }
}
