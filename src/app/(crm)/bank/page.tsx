import { redirect } from "next/navigation";
import { ErpGrid } from "@/components/erp/erp-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listBankTransactions } from "@/lib/erp/data";

export default async function BankPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "bank", "view"))) redirect("/dashboard");
  const rows = await listBankTransactions();
  return (
    <ErpGrid
      title="법인통장"
      rows={rows}
      uploadType="bank-transactions"
      uploadEnabled
      columns={[
        { field: "transactedOn", headerName: "거래일", type: "date", width: 130 },
        { field: "bankName", headerName: "은행", width: 120 },
        { field: "accountNumber", headerName: "계좌", width: 180 },
        { field: "description", headerName: "내용", width: 260 },
        { field: "depositAmount", headerName: "입금", type: "money", width: 140 },
        { field: "withdrawalAmount", headerName: "출금", type: "money", width: 140 },
        { field: "balanceAmount", headerName: "잔액", type: "money", width: 150 },
        { field: "category", headerName: "분류", width: 130 },
      ]}
    />
  );
}
