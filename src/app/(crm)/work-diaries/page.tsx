import { redirect } from "next/navigation";
import { WorkDiaryGrid } from "@/components/erp/work-diary-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listUsers } from "@/lib/customers";
import {
  currentMonthText,
  listWorkDiaryDestinations,
  listWorkDiaryRows,
  listWorkDiaryTypes,
} from "@/lib/work-diaries";

export default async function WorkDiariesPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "work-diaries", "view"))) {
    redirect("/dashboard");
  }

  const month = currentMonthText();
  const users = user.role === "admin" ? await listUsers() : [user];
  const [rows, destinations, workTypes] = await Promise.all([
    listWorkDiaryRows({
      currentUserId: user.id,
      currentUserName: user.name,
      role: user.role,
      month,
      targetUserId: user.id,
    }),
    listWorkDiaryDestinations(),
    user.role === "admin" ? listWorkDiaryTypes() : Promise.resolve([]),
  ]);

  return (
    <WorkDiaryGrid
      initialRows={rows}
      initialDestinations={destinations}
      initialWorkTypes={workTypes}
      users={users}
      currentUser={user}
      initialMonth={month}
    />
  );
}
