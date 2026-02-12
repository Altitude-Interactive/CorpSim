export const UI_CADENCE_TERMS = {
  singularTitle: "Week",
  pluralTitle: "Weeks",
  singular: "week",
  plural: "weeks",
  fromField: "fromWeek",
  toField: "toWeek",
  windowField: "windowWeeks"
} as const;

function resolveCadenceNoun(count: number): string {
  return Math.abs(count) === 1 ? UI_CADENCE_TERMS.singular : UI_CADENCE_TERMS.plural;
}

export function formatCadenceCount(count: number): string {
  return `${count.toLocaleString()} ${resolveCadenceNoun(count)}`;
}

export function formatCadencePoint(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return `${UI_CADENCE_TERMS.singularTitle} --`;
  }

  return `${UI_CADENCE_TERMS.singularTitle} ${value.toLocaleString()}`;
}
