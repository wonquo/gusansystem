import { redirect } from "next/navigation";
import { ProjectScheduleGrid } from "@/components/erp/project-schedule-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listProjectSchedules } from "@/lib/erp/data";
import { listProjectScheduleStatusOptions } from "@/lib/project-schedule-status-options";

export default async function ProjectSchedulesPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "project-schedules", "view"))) {
    redirect("/dashboard");
  }

  const [mainRows, subRows, canCreate, canUpdate, canDelete, canUpload, statusOptions] = await Promise.all([
    listProjectSchedules({ projectType: "main" }),
    listProjectSchedules({ projectType: "sub" }),
    canAccessMenu(user.role, "project-schedules", "create"),
    canAccessMenu(user.role, "project-schedules", "update"),
    canAccessMenu(user.role, "project-schedules", "delete"),
    canAccessMenu(user.role, "project-schedules", "upload"),
    listProjectScheduleStatusOptions(),
  ]);

  return (
    <ProjectScheduleGrid
      mainRows={mainRows}
      subRows={subRows}
      permissions={{ canCreate, canUpdate, canDelete, canUpload }}
      statusOptions={statusOptions}
    />
  );
}
