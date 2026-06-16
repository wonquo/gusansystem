import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { listActivePopupNotices } from "@/lib/notices";

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notices = await listActivePopupNotices();

    return NextResponse.json({ notices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
