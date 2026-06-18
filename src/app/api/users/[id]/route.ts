import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, hasDatabaseUrl } from "@/db";
import {
  appUsers,
  boardComments,
  boardPosts,
  calendarEvents,
  customerActivities,
  customers,
  employees,
  importBatches,
  noticeComments,
  notices,
} from "@/db/schema";
import { canManageUsers, getCurrentAppUser, hashPassword, serializeUser } from "@/lib/auth";
import { normalizeProfileImageUrl } from "@/lib/profile-image";

const userUpdateSchema = z
  .object({
    loginId: z.string().trim().min(3, "로그인 ID는 3자 이상이어야 합니다.").optional(),
    employeeCode: z.string().trim().max(40, "사원코드는 40자 이하로 입력해 주세요.").optional(),
    email: z.email("올바른 이메일을 입력해 주세요.").trim().toLowerCase().optional(),
    name: z.string().trim().min(1, "이름을 입력해 주세요.").optional(),
    profileImageUrl: z.string().trim().max(2048, "이미지 URL이 너무 깁니다.").optional(),
    password: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다.").optional(),
    role: z.enum(["admin", "employee"]).optional(),
    status: z.enum(["active", "invited", "disabled"]).optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentAppUser();
    if (!currentUser || !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = userUpdateSchema.parse(await request.json());
    const { employeeCode: rawEmployeeCode, password, ...userBody } = body;
    const patch = {
      ...userBody,
      ...(Object.hasOwn(userBody, "profileImageUrl")
        ? { profileImageUrl: normalizeProfileImageUrl(userBody.profileImageUrl) }
        : {}),
      ...(password ? { passwordHash: hashPassword(password) } : {}),
    };
    const hasEmployeeCodePatch = Object.hasOwn(body, "employeeCode");
    const employeeCode = hasEmployeeCodePatch ? normalizeEmployeeCode(rawEmployeeCode) : undefined;

    if (!hasDatabaseUrl()) {
      const publicPatch = {
        ...userBody,
        ...(Object.hasOwn(userBody, "profileImageUrl")
          ? { profileImageUrl: normalizeProfileImageUrl(userBody.profileImageUrl) }
          : {}),
      };

      return NextResponse.json({
        user: { id, ...publicPatch, ...(hasEmployeeCodePatch ? { employeeCode } : {}) },
      });
    }

    const db = getDb();
    const [updated] = await db
      .update(appUsers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(appUsers.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    let nextEmployeeCode: string | null = null;
    const currentEmployee = await db.query.employees.findFirst({
      where: eq(employees.userId, id),
    });

    if (hasEmployeeCodePatch) {
      if (employeeCode) {
        const employeeByCode = await db.query.employees.findFirst({
          where: eq(employees.employeeCode, employeeCode),
        });

        if (currentEmployee && employeeByCode && currentEmployee.id !== employeeByCode.id) {
          await db
            .update(employees)
            .set({ userId: null, updatedAt: new Date() })
            .where(eq(employees.id, currentEmployee.id));
        }

        if (employeeByCode) {
          await db
            .update(employees)
            .set({
              name: updated.name,
              userId: id,
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(employees.id, employeeByCode.id));
          nextEmployeeCode = employeeCode;
        } else if (currentEmployee) {
          await db
            .update(employees)
            .set({
              employeeCode,
              name: updated.name,
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(employees.id, currentEmployee.id));
          nextEmployeeCode = employeeCode;
        } else {
          await db.insert(employees).values({
            employeeCode,
            name: updated.name,
            userId: id,
            status: "active",
          });
          nextEmployeeCode = employeeCode;
        }
      } else if (currentEmployee) {
        await db
          .update(employees)
          .set({ employeeCode: null, name: updated.name, updatedAt: new Date() })
          .where(eq(employees.id, currentEmployee.id));
        nextEmployeeCode = null;
      }
    } else {
      if (currentEmployee && patch.name) {
        await db
          .update(employees)
          .set({ name: updated.name, updatedAt: new Date() })
          .where(eq(employees.id, currentEmployee.id));
      }
      nextEmployeeCode = currentEmployee?.employeeCode ?? null;
    }

    return NextResponse.json({ user: { ...serializeUser(updated), employeeCode: nextEmployeeCode } });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "입력값을 확인해 주세요.")
        : error instanceof Error
          ? error.message
          : "Invalid request";
    const isDuplicate =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      String(error.message).includes("duplicate key");

    return NextResponse.json(
      { error: isDuplicate ? "이미 사용 중인 로그인 ID 또는 이메일입니다." : message },
      { status: 400 },
    );
  }
}

function normalizeEmployeeCode(value: string | undefined) {
  const code = value?.trim();
  return code ? code : null;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentAppUser();
    if (!currentUser || !canManageUsers(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (currentUser.id === id) {
      return NextResponse.json({ error: "현재 로그인한 사용자는 삭제할 수 없습니다." }, { status: 400 });
    }

    if (!hasDatabaseUrl()) {
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
    const now = new Date();

    // FK 제약(ON DELETE 정책)이 환경마다 다를 수 있으므로, 사용자 계정을 참조하는
    // 모든 행의 참조를 먼저 해제한 뒤 삭제한다. neon-http 드라이버는 interactive
    // transaction을 지원하지 않으므로 batch로 한 번에 원자적으로 실행한다.
    const [, , , , , , , , , deletedRows] = await db.batch([
      db.update(employees).set({ userId: null, updatedAt: now }).where(eq(employees.userId, id)),
      db
        .update(customers)
        .set({ assignedUserId: null, updatedAt: now })
        .where(eq(customers.assignedUserId, id)),
      db.update(customerActivities).set({ createdBy: null }).where(eq(customerActivities.createdBy, id)),
      db.update(notices).set({ createdBy: null }).where(eq(notices.createdBy, id)),
      db.update(noticeComments).set({ createdBy: null }).where(eq(noticeComments.createdBy, id)),
      db.update(boardPosts).set({ createdBy: null }).where(eq(boardPosts.createdBy, id)),
      db.update(boardComments).set({ createdBy: null }).where(eq(boardComments.createdBy, id)),
      db.update(calendarEvents).set({ createdBy: null }).where(eq(calendarEvents.createdBy, id)),
      db.update(importBatches).set({ importedBy: null }).where(eq(importBatches.importedBy, id)),
      db.delete(appUsers).where(eq(appUsers.id, id)).returning({ id: appUsers.id }),
    ]);

    const deleted = deletedRows[0];
    if (!deleted) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "사용자를 삭제하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
