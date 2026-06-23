export function isUniqueViolation(error: unknown, constraintNames: readonly string[] = []) {
  const values = collectErrorValues(error).map((value) => value.toLowerCase());
  const constraints = constraintNames.map((value) => value.toLowerCase());

  return values.some(
    (value) =>
      value === "23505" ||
      value.includes("duplicate key") ||
      value.includes("unique constraint") ||
      constraints.some((constraint) => value.includes(constraint)),
  );
}

export function getSafeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return error.message.startsWith("Failed query:") ? fallback : error.message;
}

function collectErrorValues(error: unknown, seen = new Set<unknown>()): string[] {
  if (!error || seen.has(error)) {
    return [];
  }

  if (typeof error === "string" || typeof error === "number") {
    return [String(error)];
  }

  if (typeof error !== "object") {
    return [];
  }

  seen.add(error);

  const record = error as Record<string, unknown>;
  const values = ["message", "code", "detail", "constraint", "name"]
    .map((key) => record[key])
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String);

  return [...values, ...collectErrorValues(record.cause, seen)];
}
