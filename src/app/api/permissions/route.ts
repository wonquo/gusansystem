import { NextResponse } from "next/server";
import { z } from "zod";
import { listPermissions, updatePermission, updatePermissionsForRole } from "@/lib/erp/data";
import { jsonError, requireErpPermission } from "@/lib/erp/api";
import { ERP_MENUS } from "@/lib/erp/menus";

const roleSchema = z.enum(["admin", "employee"]);
const menuKeySchema = z.enum(ERP_MENUS.map((menu) => menu.key) as [string, ...string[]]);

const permissionSchema = z.object({
  role: roleSchema,
  menuKey: menuKeySchema,
  action: z.enum(["view", "create", "update", "delete", "upload"]),
  value: z.boolean(),
});

const permissionRowSchema = z.object({
  menuKey: menuKeySchema,
  canView: z.boolean(),
  canCreate: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
  canUpload: z.boolean(),
});

const permissionBulkSchema = z.object({
  role: z.enum(["admin", "employee"]),
  rows: z.array(permissionRowSchema),
});

const permissionPatchSchema = z.union([permissionBulkSchema, permissionSchema]);

export async function GET() {
  const guard = await requireErpPermission("permissions", "view");
  if (guard.response) return guard.response;
  return NextResponse.json({ rows: await listPermissions(), menus: ERP_MENUS });
}

export async function PATCH(request: Request) {
  try {
    const guard = await requireErpPermission("permissions", "update");
    if (guard.response) return guard.response;
    const body = permissionPatchSchema.parse(await request.json());
    if ("rows" in body) {
      const rows = await updatePermissionsForRole(body.role, body.rows as never);
      return NextResponse.json({ rows });
    }
    const row = await updatePermission(body.role, body.menuKey as never, {
      [body.action]: body.value,
    });
    return NextResponse.json({ row });
  } catch (error) {
    return jsonError(error);
  }
}
