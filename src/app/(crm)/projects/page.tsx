import { redirect } from "next/navigation";
import { ErpGrid } from "@/components/erp/erp-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listProjects } from "@/lib/erp/data";

export default async function ProjectsPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "projects", "view"))) redirect("/dashboard");
  const canCreateProjects = await canAccessMenu(user.role, "projects", "create");
  const rows = await listProjects();
  return (
    <ErpGrid
      title="프로젝트 관리"
      rows={rows}
      uploadType="projects"
      uploadEnabled
      createEnabled={canCreateProjects}
      detailType="project"
      columns={[
        { field: "orderedOn", headerName: "일자", type: "date", width: 120 },
        { field: "projectName", headerName: "프로젝트명", width: 360 },
        { field: "clientName", headerName: "업체", width: 170 },
        { field: "contractAmount", headerName: "수주금액", type: "money", width: 140 },
        { field: "receivedAmount", headerName: "결제금액", type: "money", width: 140 },
        { field: "spentAmount", headerName: "집행금액", type: "money", width: 140 },
        { field: "profitAmount", headerName: "이익", type: "money", width: 140 },
      ]}
    />
  );
}
