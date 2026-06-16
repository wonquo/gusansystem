import { ErpGrid } from "@/components/erp/erp-grid";
import { requireAppUser } from "@/lib/auth";
import { listPayrollSlips } from "@/lib/erp/data";

export default async function MyPayrollPage() {
  const user = await requireAppUser();
  const rows = await listPayrollSlips({ currentUserId: user.id, role: user.role, scope: "mine" });
  return (
    <ErpGrid
      title="내 급여명세서"
      rows={rows}
      detailType="payroll-slip"
      searchMode="payroll"
      payrollScope="mine"
      columns={[
        { field: "payrollMonth", headerName: "지급월", width: 120 },
        { field: "employeeName", headerName: "성명", width: 120 },
        { field: "position", headerName: "직책", width: 120 },
        { field: "grossPay", headerName: "지급액계", type: "money", width: 150 },
        { field: "totalDeduction", headerName: "공제액계", type: "money", width: 150 },
        { field: "netPay", headerName: "지급총액", type: "money", width: 150 },
      ]}
    />
  );
}
