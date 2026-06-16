import { NextResponse } from "next/server";
import {
  createProjectWithItems,
  deleteProject,
  listProjects,
  updateProjectWithItems,
} from "@/lib/erp/data";
import { jsonError, requireErpPermission } from "@/lib/erp/api";

export async function GET(request: Request) {
  const guard = await requireErpPermission("projects", "view");
  if (guard.response) return guard.response;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({ rows: await listProjects({ query: searchParams.get("query") }) });
}

export async function POST(request: Request) {
  try {
    const guard = await requireErpPermission("projects", "create");
    if (guard.response) return guard.response;
    const row = await createProjectWithItems(await request.json());
    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireErpPermission("projects", "update");
    if (guard.response) return guard.response;
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "프로젝트 ID가 필요합니다." }, { status: 400 });
    }
    const row = await updateProjectWithItems(id, body);
    return NextResponse.json({ row });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireErpPermission("projects", "delete");
    if (guard.response) return guard.response;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "프로젝트 ID가 필요합니다." }, { status: 400 });
    }
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
