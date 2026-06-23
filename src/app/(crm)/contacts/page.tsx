import { redirect } from "next/navigation";
import { ContactGrid } from "@/components/erp/contact-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listContacts } from "@/lib/contacts";

export default async function ContactsPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "contacts", "view"))) {
    redirect("/dashboard");
  }

  const [rows, canCreate, canUpdate, canDelete] = await Promise.all([
    listContacts(null),
    canAccessMenu(user.role, "contacts", "create"),
    canAccessMenu(user.role, "contacts", "update"),
    canAccessMenu(user.role, "contacts", "delete"),
  ]);

  return (
    <ContactGrid
      initialRows={rows}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
