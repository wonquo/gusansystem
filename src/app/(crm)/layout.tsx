import { AdminShell } from "@/components/admin/admin-shell";
import { requireAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser();

  return <AdminShell user={user}>{children}</AdminShell>;
}
