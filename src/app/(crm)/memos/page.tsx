import { redirect } from "next/navigation";
import { MemoGrid } from "@/components/erp/memo-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listMemos } from "@/lib/memos";

export default async function MemosPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "memos", "view"))) {
    redirect("/dashboard");
  }

  const [rows, canCreate, canUpdate, canDelete] = await Promise.all([
    listMemos(null, user.id),
    canAccessMenu(user.role, "memos", "create"),
    canAccessMenu(user.role, "memos", "update"),
    canAccessMenu(user.role, "memos", "delete"),
  ]);

  return (
    <MemoGrid
      initialRows={rows}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
