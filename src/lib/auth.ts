import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq, or } from "drizzle-orm";
import { appUsers, employees, type AppUserRole } from "@/db/schema";
import { getDb, hasDatabaseUrl } from "@/db";
import type { AppUserRow } from "./types";

const SESSION_COOKIE = "guesan_erp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const EMPLOYEE_MENU_PERMISSIONS: Record<
  string,
  readonly ("view" | "create" | "update" | "delete" | "upload")[]
> = {
  dashboard: ["view"],
  board: ["view", "create"],
  calendar: ["view", "create"],
  "work-diaries": ["view", "create", "update", "delete"],
  memos: ["view", "create", "update", "delete"],
};

export function canManageUsers(role: AppUserRole) {
  return role === "admin";
}

export function canManageCustomers(role: AppUserRole) {
  return role === "admin";
}

export function canManageNotices(role: AppUserRole) {
  return role === "admin";
}

export function isAdmin(role: AppUserRole) {
  return role === "admin";
}

export async function getLinkedEmployee(userId: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  return getDb().query.employees.findFirst({
    where: eq(employees.userId, userId),
  });
}

export async function canAccessMenu(
  role: AppUserRole,
  menuKey: string,
  action: "view" | "create" | "update" | "delete" | "upload" = "view",
) {
  if (role === "admin") {
    return true;
  }

  if (role === "employee") {
    return EMPLOYEE_MENU_PERMISSIONS[menuKey]?.includes(action) ?? false;
  }

  if (!hasDatabaseUrl()) {
    return false;
  }

  const permission = await getDb().query.menuPermissions.findFirst({
    where: (table, { and, eq }) => and(eq(table.role, role), eq(table.menuKey, menuKey)),
  });
  if (!permission) {
    return false;
  }

  return {
    view: permission.canView,
    create: permission.canCreate,
    update: permission.canUpdate,
    delete: permission.canDelete,
    upload: permission.canUpload,
  }[action];
}

export async function requireAppUser() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/");
  }

  return user;
}

export const getCurrentAppUser = cache(async (): Promise<AppUserRow | null> => {
  if (!hasDatabaseUrl()) {
    return null;
  }

  await ensureBootstrapAdmin();

  const session = await readSession();
  if (!session) {
    return null;
  }

  const user = await getDb().query.appUsers.findFirst({
    where: eq(appUsers.id, session.userId),
  });

  if (!user || user.status !== "active") {
    return null;
  }

  return serializeUser(user);
});

export async function verifyLogin(loginId: string, password: string) {
  if (!hasDatabaseUrl()) {
    return null;
  }

  await ensureBootstrapAdmin();

  const user = await getDb().query.appUsers.findFirst({
    where: eq(appUsers.loginId, loginId.trim()),
  });

  if (!user || user.status !== "active" || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  const [updated] = await getDb()
    .update(appUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(appUsers.id, user.id))
    .returning();

  await writeSession(updated.id);

  return serializeUser(updated);
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function serializeUser(user: typeof appUsers.$inferSelect): AppUserRow {
  return {
    id: user.id,
    employeeCode: null,
    loginId: user.loginId,
    email: user.email,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, "hex");

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

async function ensureBootstrapAdmin() {
  if (!hasDatabaseUrl()) {
    return;
  }

  const loginId = process.env.BOOTSTRAP_LOGIN_ID?.trim() || "admin";
  const password = process.env.BOOTSTRAP_PASSWORD;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@example.com";
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "관리자";

  if (!password) {
    return;
  }

  const db = getDb();
  const existing = await db.query.appUsers.findFirst({
    where: or(eq(appUsers.loginId, loginId), eq(appUsers.email, email)),
  });

  if (existing) {
    return;
  }

  await db.insert(appUsers).values({
    loginId,
    passwordHash: hashPassword(password),
    email,
    name,
    role: "admin",
    status: "active",
  }).onConflictDoNothing({
    target: appUsers.loginId,
  });
}

async function writeSession(userId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();

  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

async function readSession() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }

  const [userId, expiresAtText, signature] = value.split(".");
  const payload = `${userId}.${expiresAtText}`;
  const expiresAt = Number(expiresAtText);

  if (!userId || !expiresAt || expiresAt < Date.now() || signature !== sign(payload)) {
    return null;
  }

  return { userId };
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function getSessionSecret() {
  return process.env.APP_SESSION_SECRET || "local-dev-session-secret";
}
