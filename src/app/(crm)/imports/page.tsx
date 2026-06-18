import { redirect } from "next/navigation";
import { ErpGrid } from "@/components/erp/erp-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listImportBatches } from "@/lib/erp/data";

export default async function ImportsPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "imports", "view"))) redirect("/dashboard");
  const rows = await listImportBatches();
  return (
    <ErpGrid
      title="업로드 이력"
      rows={rows}
      columns={[
        { field: "createdAt", headerName: "업로드 시각", width: 180 },
        { field: "fileName", headerName: "파일명", width: 260 },
        { field: "importType", headerName: "유형", width: 150 },
        { field: "sheetName", headerName: "시트", width: 160 },
        { field: "status", headerName: "상태", width: 120 },
        { field: "successCount", headerName: "성공", width: 100 },
        { field: "errorCount", headerName: "오류", width: 100 },
        { field: "importerName", headerName: "업로드 사용자", width: 150 },
      ]}
    />
  );
}
