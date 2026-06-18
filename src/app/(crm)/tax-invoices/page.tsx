import { redirect } from "next/navigation";
import { ErpGrid } from "@/components/erp/erp-grid";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { listTaxInvoices } from "@/lib/erp/data";

export default async function TaxInvoicesPage() {
  const user = await requireAppUser();
  if (!(await canAccessMenu(user.role, "tax-invoices", "view"))) redirect("/dashboard");
  const rows = await listTaxInvoices();
  return (
    <ErpGrid
      title="전자세금계산서"
      rows={rows}
      uploadType="tax-invoices"
      uploadEnabled
      columns={[
        { field: "issuedOn", headerName: "발행일", type: "date", width: 130 },
        { field: "direction", headerName: "구분", width: 100 },
        { field: "partnerName", headerName: "거래처", width: 200 },
        { field: "projectName", headerName: "프로젝트", width: 220 },
        { field: "itemName", headerName: "품목", width: 180 },
        { field: "supplyAmount", headerName: "공급가액", type: "money", width: 150 },
        { field: "taxAmount", headerName: "세액", type: "money", width: 130 },
        { field: "totalAmount", headerName: "합계", type: "money", width: 150 },
      ]}
    />
  );
}
