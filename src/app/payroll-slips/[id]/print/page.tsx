import { notFound } from "next/navigation";
import { PayrollPrintActions } from "@/components/erp/payroll-print-actions";
import { PayrollSlipView } from "@/components/erp/payroll-slip-view";
import { canAccessMenu, requireAppUser } from "@/lib/auth";
import { getPayrollSlipById } from "@/lib/erp/data";

export const dynamic = "force-dynamic";

export default async function PayrollSlipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireAppUser()]);
  const menuKey = user.role === "admin" ? "payroll" : "my-payroll";
  const allowed = await canAccessMenu(user.role, menuKey, "view");
  if (!allowed) {
    notFound();
  }

  const slip = await getPayrollSlipById({
    id,
    currentUserId: user.id,
    role: user.role,
  });
  if (!slip) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#eef2f7] text-[#1f2937] print:min-h-0 print:bg-white">
      <PayrollPrintActions pdfUrl={`/api/payroll-slips/${encodeURIComponent(id)}/pdf`} />
      <div className="mx-auto w-full max-w-[210mm] px-4 pb-6 print:max-w-none print:p-0">
        <PayrollSlipView
          row={slip}
          className="mx-auto h-[258mm] max-h-[258mm] w-full max-w-[190mm] flex-none rounded-lg shadow-[0_18px_48px_rgba(15,28,48,0.12)] print:h-[calc(297mm-20mm)] print:max-h-[calc(297mm-20mm)] print:max-w-none print:rounded-none print:border-[#d8e0ea] print:shadow-none"
        />
      </div>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        [data-payroll-slip="true"],
        [data-payroll-slip="true"] * {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        @media print {
          html,
          body {
            width: 210mm;
            min-height: 297mm;
            background: #ffffff !important;
          }
        }
      `}</style>
    </main>
  );
}
