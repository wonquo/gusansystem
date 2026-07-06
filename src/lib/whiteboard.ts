import { eq } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, whiteboardStates } from "@/db/schema";
import type { WhiteboardStateRow } from "@/lib/types";

const WHITEBOARD_ID = "dashboard";

export type WhiteboardInput = {
  textContent?: string;
  canvasDataUrl?: string;
};

export function getEmptyWhiteboardState(): WhiteboardStateRow {
  return {
    id: WHITEBOARD_ID,
    textContent: "",
    canvasDataUrl: "",
    updatedBy: null,
    updatedByName: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getWhiteboardState(): Promise<WhiteboardStateRow> {
  if (!hasDatabaseUrl()) {
    return getEmptyWhiteboardState();
  }

  let row:
    | {
        state: typeof whiteboardStates.$inferSelect;
        updatedByName: string | null;
      }
    | undefined;

  try {
    [row] = await getDb()
      .select({
        state: whiteboardStates,
        updatedByName: appUsers.name,
      })
      .from(whiteboardStates)
      .leftJoin(appUsers, eq(whiteboardStates.updatedBy, appUsers.id))
      .where(eq(whiteboardStates.id, WHITEBOARD_ID))
      .limit(1);
  } catch (error) {
    if (isMissingWhiteboardTableError(error)) {
      return getEmptyWhiteboardState();
    }
    throw error;
  }

  return row ? serializeWhiteboardState(row.state, row.updatedByName) : getEmptyWhiteboardState();
}

export async function updateWhiteboardState(input: WhiteboardInput, updatedBy: string) {
  await getDb()
    .insert(whiteboardStates)
    .values({
      id: WHITEBOARD_ID,
      textContent: normalizeText(input.textContent),
      canvasDataUrl: normalizeCanvasDataUrl(input.canvasDataUrl),
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: whiteboardStates.id,
      set: {
        textContent: normalizeText(input.textContent),
        canvasDataUrl: normalizeCanvasDataUrl(input.canvasDataUrl),
        updatedBy,
        updatedAt: new Date(),
      },
    });

  return getWhiteboardState();
}

function normalizeText(value?: string) {
  return (value ?? "").slice(0, 12_000_000);
}

function normalizeCanvasDataUrl(value?: string) {
  const dataUrl = value?.trim() ?? "";
  if (!dataUrl) {
    return "";
  }

  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) {
    throw new Error("이미지 데이터 형식이 올바르지 않습니다.");
  }

  if (dataUrl.length > 6_500_000) {
    throw new Error("화이트보드 이미지가 너무 큽니다.");
  }

  return dataUrl;
}

function serializeWhiteboardState(
  state: typeof whiteboardStates.$inferSelect,
  updatedByName: string | null,
): WhiteboardStateRow {
  return {
    id: state.id,
    textContent: state.textContent,
    canvasDataUrl: state.canvasDataUrl,
    updatedBy: state.updatedBy,
    updatedByName,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  };
}

function isMissingWhiteboardTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    message?: string;
    cause?: { message?: string; code?: string };
    code?: string;
  };
  const detail = [record.message, record.cause?.message, record.code, record.cause?.code]
    .filter(Boolean)
    .join("\n");

  return detail.includes("whiteboard_states") && (detail.includes("does not exist") || detail.includes("42P01"));
}
