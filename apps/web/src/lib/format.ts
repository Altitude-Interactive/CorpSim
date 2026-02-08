export function formatInt(value: number): string {
  return value.toLocaleString();
}

export function formatCents(value: string): string {
  const cents = Number(value);
  if (!Number.isFinite(cents)) {
    return value;
  }

  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function parseCurrencyToCents(value: string): number | null {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const cents = Math.round(parsed * 100);
  return cents > 0 ? cents : null;
}
