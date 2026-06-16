import type { ReactNode } from "react";
import {
  CalendarCheck,
  CircleDollarSign,
  Info,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PayrollSlipRow = Record<string, unknown>;

export type PayrollItemDetail = {
  id?: string;
  itemType?: string;
  label?: string;
  amount?: number;
  sortOrder?: number;
};

export function PayrollSlipView({
  row,
  className,
}: {
  row: PayrollSlipRow;
  className?: string;
}) {
  const items = getPayrollItems(row);
  const earnings = items.filter((item) => item.itemType === "earning");
  const deductions = items.filter((item) => item.itemType === "deduction");
  const employeeName = String(row.employeeName ?? "-");
  const payrollMonth = String(row.payrollMonth ?? "-");
  const position = String(row.position ?? "직책 미입력");
  const employeeCode = String(row.employeeCode ?? "-");
  const bankAccount = row.payrollBankAccount ? String(row.payrollBankAccount) : "";
  const joinedAt = formatDate(row.joinedAt ?? row.hireDate ?? row.employmentDate ?? row.joinDate) || "-";

  return (
    <div
      data-payroll-slip="true"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#d8e0ea] bg-white text-[#1f2937] shadow-[0_10px_30px_rgba(15,28,48,0.06)]",
        className,
      )}
    >
      <div className="shrink-0 px-4 pt-4 pb-2 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight text-[#0f172a]">급여명세서</h2>
        <p className="mx-auto mt-2 w-fit rounded-md bg-[#eef4ff] px-2.5 py-1 text-[11px] font-bold text-[#2563eb]">
          {payrollMonth} 급여
        </p>
      </div>

      <div className="mx-4 shrink-0 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
        <div className="flex items-center gap-1.5 border-b border-[#e2e8f0] px-3 py-2 text-[12px] font-extrabold text-[#2563eb]">
          <UserRound className="size-3.5" />
          사원 정보
        </div>
        <PayrollEmployeeTable
          employeeCode={employeeCode}
          employeeName={employeeName}
          position={position}
          joinedAt={joinedAt}
          bankAccount={bankAccount || "-"}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-3">
        <PayrollItemSection
          title="지급액"
          items={earnings}
          total={row.grossPay}
          icon={<CalendarCheck className="size-3.5" />}
          tone="blue"
        />
        <PayrollItemSection
          title="공제액"
          items={deductions}
          total={row.totalDeduction}
          icon={<ShieldCheck className="size-3.5" />}
          tone="red"
        />
      </div>

      <PayrollNetSummary grossPay={row.grossPay} totalDeduction={row.totalDeduction} netPay={row.netPay} />

      <div className="mx-4 mb-4 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#d8e0ea] bg-[#f8fafc] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Info className="size-3.5 shrink-0 text-[#2563eb]" />
          <p className="shrink-0 text-[11px] font-extrabold text-[#334155]">비고</p>
          <p className="min-w-0 truncate text-[11px] font-medium text-[#64748b]">
            위 급여는 {payrollMonth} 급여에 대한 내역입니다.
          </p>
        </div>
        <p className="text-right text-[11px] font-semibold text-[#64748b]">발급일자 {formatDate(new Date())}</p>
      </div>
    </div>
  );
}

function PayrollEmployeeTable({
  employeeCode,
  employeeName,
  position,
  joinedAt,
  bankAccount,
}: {
  employeeCode: string;
  employeeName: string;
  position: string;
  joinedAt: string;
  bankAccount: string;
}) {
  const columns = [
    { label: "사원코드", value: employeeCode },
    { label: "성명", value: employeeName },
    { label: "직책", value: position },
    { label: "입사일자", value: joinedAt },
    { label: "급여통장", value: bankAccount },
  ];

  return (
    <div className="grid grid-cols-[88px_76px_64px_84px_minmax(0,1fr)]">
      {columns.map((column) => (
        <div key={column.label} className="min-w-0 border-r border-[#e2e8f0] last:border-r-0">
          <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-2 py-2 text-center text-[10px] font-bold text-[#64748b]">
            {column.label}
          </div>
          <div className="truncate px-2 py-2.5 text-center text-[11px] font-extrabold text-[#111827]">
            {column.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PayrollNetSummary({
  grossPay,
  totalDeduction,
  netPay,
}: {
  grossPay: unknown;
  totalDeduction: unknown;
  netPay: unknown;
}) {
  return (
    <div className="mx-4 mb-3 grid shrink-0 grid-cols-[minmax(84px,1fr)_auto_minmax(72px,0.85fr)_auto_minmax(72px,0.85fr)_auto_minmax(92px,1fr)] items-center gap-1.5 rounded-lg border border-[#d8e0ea] bg-white px-2.5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]">
          <CircleDollarSign className="size-4" />
        </span>
        <PayrollSummaryAmount label="지급총액" value={netPay} emphasis />
      </div>
      <PayrollEquationMark value="=" />
      <PayrollSummaryAmount label="지급액 합계" value={grossPay} />
      <PayrollEquationMark value="-" />
      <PayrollSummaryAmount label="공제액 합계" value={totalDeduction} negative />
      <PayrollEquationMark value="=" />
      <div className="min-w-0 rounded-md border border-[#dbeafe] bg-[#eff6ff] px-2.5 py-2 text-right">
        <PayrollSummaryAmount label="지급총액" value={netPay} emphasis />
      </div>
    </div>
  );
}

function PayrollSummaryAmount({
  label,
  value,
  emphasis = false,
  negative = false,
}: {
  label: string;
  value: unknown;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-bold text-[#64748b]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-[12px] font-extrabold",
          emphasis && "text-[#2563eb]",
          negative && "text-[#ef4444]",
          !emphasis && !negative && "text-[#0f172a]",
        )}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}

function PayrollEquationMark({ value }: { value: string }) {
  return <span className="text-sm font-black text-[#94a3b8]">{value}</span>;
}

function PayrollItemSection({
  title,
  items,
  total,
  icon,
  tone,
}: {
  title: string;
  items: PayrollItemDetail[];
  total: unknown;
  icon: ReactNode;
  tone: "blue" | "red";
}) {
  const toneClass =
    tone === "blue"
      ? {
          title: "text-[#2563eb]",
          line: "border-[#bfdbfe]",
          total: "bg-[#eff6ff] text-[#2563eb]",
        }
      : {
          title: "text-[#ef4444]",
          line: "border-[#fecdd3]",
          total: "bg-[#fff1f2] text-[#ef4444]",
        };

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
      <div className={cn("flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2", toneClass.line)}>
        <p className={cn("flex items-center gap-1.5 text-[12px] font-extrabold", toneClass.title)}>
          {icon}
          {title}
        </p>
        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-black text-[#475569]">
          {items.length}개
        </span>
      </div>
      <div className="grid min-h-0 flex-1 content-start overflow-hidden">
        {items.length ? items.map((item, index) => (
          <div
            key={item.id ?? `${item.label}-${index}`}
            className="grid min-h-7 grid-cols-[minmax(0,1fr)_104px] border-b border-[#edf1f5]"
          >
            <span className="min-w-0 truncate px-3 py-1.5 text-[11px] font-semibold text-[#475569]">
              {item.label ?? "-"}
            </span>
            <span className="px-3 py-1.5 text-right text-[11px] font-bold whitespace-nowrap text-[#111827]">
              {formatMoney(item.amount)}
            </span>
          </div>
        )) : (
          <div className="flex min-h-20 items-center justify-center px-3 text-center text-[11px] font-semibold text-[#94a3b8]">
            항목 없음
          </div>
        )}
        <div className={cn("mt-auto grid min-h-8 grid-cols-[minmax(0,1fr)_104px] border-t px-0 font-black", toneClass.line, toneClass.total)}>
          <span className="min-w-0 truncate px-3 py-2">합계</span>
          <span className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(total)}</span>
        </div>
      </div>
    </section>
  );
}

export function getPayrollItems(row: PayrollSlipRow) {
  const items = row.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => item as PayrollItemDetail)
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
}

export function formatMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? `${number.toLocaleString()}원` : "";
}

export function formatDate(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}
