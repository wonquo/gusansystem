import { redirect } from "next/navigation";
import { PermissionManager } from "@/components/erp/permission-manager";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listPermissions } from "@/lib/erp/data";
import { ERP_MENUS } from "@/lib/erp/menus";

export default async function PermissionsPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "permissions", "view"))) redirect("/my-payroll");
  const rows = await listPermissions();
  return <PermissionManager initialRows={rows} menus={ERP_MENUS} />;
}
