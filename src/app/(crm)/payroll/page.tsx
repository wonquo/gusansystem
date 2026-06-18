import { redirect } from "next/navigation";
import { ErpGrid } from "@/components/erp/erp-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listPayrollSlips } from "@/lib/erp/data";

export default async function PayrollPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "payroll", "view"))) redirect("/dashboard");
  const [rows, canDeletePayroll] = await Promise.all([
    listPayrollSlips({ currentUserId: user.id, role: user.role, scope: "all" }),
    canAccessMenu(user.role, "payroll", "delete"),
  ]);
  return (
    <ErpGrid
      title="급여대장"
      rows={rows}
      uploadType="payroll-slips"
      uploadEnabled={user.role === "admin"}
      deleteEnabled={canDeletePayroll}
      detailType="payroll-slip"
      searchMode="payroll"
      columns={[
        { field: "payrollMonth", headerName: "지급월", width: 120 },
        { field: "employeeCode", headerName: "사원코드", width: 120 },
        { field: "employeeName", headerName: "성명", width: 120 },
        { field: "position", headerName: "직책", width: 120 },
        { field: "grossPay", headerName: "지급액계", type: "money", width: 150 },
        { field: "totalDeduction", headerName: "공제액계", type: "money", width: 150 },
        { field: "netPay", headerName: "지급총액", type: "money", width: 150 },
      ]}
    />
  );
}
