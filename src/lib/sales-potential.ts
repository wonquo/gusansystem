export const SALES_TEMPERATURE_LABEL = "고객 온도";

export const SALES_POTENTIAL_OPTIONS = ["🔥 뜨거움", "🌤️ 관망", "❄️ 낮음"] as const;

export type SalesPotential = (typeof SALES_POTENTIAL_OPTIONS)[number];

export const SALES_POTENTIAL_META = [
  {
    value: SALES_POTENTIAL_OPTIONS[0],
    shortLabel: "뜨거움",
    foreground: "#b42318",
    background: "#fff1f0",
    border: "#ffccc7",
    chartColor: "#ef4444",
  },
  {
    value: SALES_POTENTIAL_OPTIONS[1],
    shortLabel: "관망",
    foreground: "#8a4b00",
    background: "#fff7e6",
    border: "#ffe0a3",
    chartColor: "#f59e0b",
  },
  {
    value: SALES_POTENTIAL_OPTIONS[2],
    shortLabel: "낮음",
    foreground: "#1d4ed8",
    background: "#eff6ff",
    border: "#bfdbfe",
    chartColor: "#3b82f6",
  },
] as const;

const LEGACY_SALES_POTENTIAL_MAP = {
  "🚀": SALES_POTENTIAL_OPTIONS[0],
  "⚠️": SALES_POTENTIAL_OPTIONS[1],
  "🛑": SALES_POTENTIAL_OPTIONS[2],
} as const;

export function normalizeSalesPotential(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  return LEGACY_SALES_POTENTIAL_MAP[trimmed as keyof typeof LEGACY_SALES_POTENTIAL_MAP] ?? trimmed;
}

export function getSalesPotentialAliases(value: string) {
  const normalized = normalizeSalesPotential(value);
  if (!normalized) return [];

  const aliases = Object.entries(LEGACY_SALES_POTENTIAL_MAP)
    .filter(([, mapped]) => mapped === normalized)
    .map(([legacy]) => legacy);

  return Array.from(new Set([normalized, ...aliases]));
}

export function getSalesPotentialMeta(value: string | null | undefined) {
  const normalized = normalizeSalesPotential(value);
  const meta = SALES_POTENTIAL_META.find((item) => item.value === normalized);

  return meta ?? {
    value: normalized ?? "미분류",
    shortLabel: normalized ?? "미분류",
    foreground: "#475569",
    background: "#f8fafc",
    border: "#e2e8f0",
    chartColor: "#94a3b8",
  };
}
