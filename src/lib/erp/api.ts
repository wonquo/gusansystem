import { NextResponse } from "next/server";
import { canAccessMenu, getCurrentAppUser } from "@/lib/auth";
import type { ErpMenuKey, PermissionAction } from "./menus";

export async function requireErpPermission(menuKey: ErpMenuKey, action: PermissionAction = "view") {
  const user = await getCurrentAppUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const allowed = await canAccessMenu(user.role, menuKey, action);
  if (!allowed) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export function jsonError(error: unknown, fallback = "요청을 처리하지 못했습니다.") {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}

