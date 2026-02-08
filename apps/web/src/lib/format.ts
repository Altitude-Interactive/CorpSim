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
