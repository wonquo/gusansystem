"use client";

import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayrollPrintActions({ pdfUrl }: { pdfUrl: string }) {
  return (
    <div className="payroll-print-actions mx-auto flex w-full max-w-[190mm] items-center justify-between gap-3 px-4 py-4 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => window.close()}>
        <ArrowLeft className="size-3.5" />
        닫기
      </Button>
      <Button type="button" size="sm" onClick={() => window.location.assign(pdfUrl)}>
        <Download className="size-3.5" />
        PDF 다운로드
      </Button>
    </div>
  );
}
