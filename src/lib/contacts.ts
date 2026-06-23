import { desc, eq, ilike, or } from "drizzle-orm";
import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, contacts } from "@/db/schema";
import type { ContactRow } from "@/lib/types";

export type ContactInput = {
  name: string;
  position?: string;
  company?: string;
  phone?: string;
  email?: string;
  task?: string;
  memo?: string;
};

export async function listContacts(query?: string | null): Promise<ContactRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const keyword = query?.trim();
  const rows = await getDb()
    .select({
      contact: contacts,
      authorName: appUsers.name,
    })
    .from(contacts)
    .leftJoin(appUsers, eq(contacts.createdBy, appUsers.id))
    .where(
      keyword
        ? or(
            ilike(contacts.name, `%${keyword}%`),
            ilike(contacts.position, `%${keyword}%`),
            ilike(contacts.company, `%${keyword}%`),
            ilike(contacts.phone, `%${keyword}%`),
            ilike(contacts.email, `%${keyword}%`),
            ilike(contacts.task, `%${keyword}%`),
            ilike(contacts.memo, `%${keyword}%`),
          )
        : undefined,
    )
    .orderBy(desc(contacts.updatedAt), desc(contacts.createdAt))
    .limit(1200);

  return rows.map(({ contact, authorName }) => serializeContact(contact, authorName));
}

export async function getContact(id: string): Promise<ContactRow | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const [row] = await getDb()
    .select({
      contact: contacts,
      authorName: appUsers.name,
    })
    .from(contacts)
    .leftJoin(appUsers, eq(contacts.createdBy, appUsers.id))
    .where(eq(contacts.id, id))
    .limit(1);

  return row ? serializeContact(row.contact, row.authorName) : null;
}

export async function createContact(input: ContactInput, createdBy: string) {
  const [contact] = await getDb()
    .insert(contacts)
    .values({
      ...normalizeContactInput(input),
      createdBy,
    })
    .returning();

  return getContact(contact.id);
}

export async function updateContact(id: string, input: ContactInput) {
  const [contact] = await getDb()
    .update(contacts)
    .set({
      ...normalizeContactInput(input),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning();

  if (!contact) {
    throw new Error("연락처를 찾지 못했습니다.");
  }

  return getContact(contact.id);
}

export async function deleteContact(id: string) {
  const [deleted] = await getDb().delete(contacts).where(eq(contacts.id, id)).returning({ id: contacts.id });
  if (!deleted) {
    throw new Error("연락처를 찾지 못했습니다.");
  }
  return deleted;
}

function normalizeContactInput(input: ContactInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("이름을 입력해 주세요.");
  }

  return {
    name,
    position: normalizeText(input.position),
    company: normalizeText(input.company),
    phone: normalizeText(input.phone),
    email: normalizeText(input.email),
    task: normalizeText(input.task),
    memo: normalizeText(input.memo),
  };
}

function normalizeText(value?: string) {
  return value?.trim() ?? "";
}

function serializeContact(contact: typeof contacts.$inferSelect, authorName: string | null): ContactRow {
  return {
    id: contact.id,
    name: contact.name,
    position: contact.position,
    company: contact.company,
    phone: contact.phone,
    email: contact.email,
    task: contact.task,
    memo: contact.memo,
    createdBy: contact.createdBy,
    authorName,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}
