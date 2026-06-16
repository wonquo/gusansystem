import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { canAccessMenu, getCurrentAppUser } from "@/lib/auth";
import { getPayrollSlipById } from "@/lib/erp/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const [{ id }, user] = await Promise.all([params, getCurrentAppUser()]);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const menuKey = user.role === "admin" ? "payroll" : "my-payroll";
    const allowed = await canAccessMenu(user.role, menuKey, "view");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const slip = await getPayrollSlipById({
      id,
      currentUserId: user.id,
      role: user.role,
    });
    if (!slip) {
      return NextResponse.json({ error: "급여명세서를 찾지 못했습니다." }, { status: 404 });
    }

    const executablePath = await getExecutablePath();
    const isLocalChrome = executablePath.startsWith("/Applications/");

    browser = await puppeteer.launch({
      args: isLocalChrome
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"]
        : [...chromium.args, "--hide-scrollbars"],
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    const cookie = request.headers.get("cookie");
    if (cookie) {
      await page.setExtraHTTPHeaders({ cookie });
    }

    const origin = new URL(request.url).origin;
    await page.goto(`${origin}/payroll-slips/${encodeURIComponent(id)}/print?pdf=1`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForSelector('[data-payroll-slip="true"]', { timeout: 30_000 });
    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      preferCSSPageSize: true,
      printBackground: true,
    });

    const filename = sanitizeFileName(`${slip.payrollMonth}_${slip.employeeName}_급여명세서.pdf`);
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "content-length": String(pdf.length),
        "content-type": "application/pdf",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF 파일을 생성하지 못했습니다." },
      { status: 500 },
    );
  } finally {
    await browser?.close();
  }
}

async function getExecutablePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean) as string[];

  const localExecutable = candidates.find((candidate) => existsSync(candidate));
  if (localExecutable) {
    return localExecutable;
  }

  return chromium.executablePath();
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}
