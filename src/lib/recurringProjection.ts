export function normalizeRecurringDescription(description?: string | null) {
  return (description ?? '').trim().toLowerCase();
}

export function buildRecurringLooseSignature(type: string, description?: string | null) {
  return `${type}|${normalizeRecurringDescription(description)}`;
}

export function buildRecurringSignature(type: string, value: number, description?: string | null) {
  return `${type}|${normalizeRecurringDescription(description)}|${Number(value).toFixed(2)}`;
}

export function buildMonthRecurringSignature(monthKey: string, type: string, value: number, description?: string | null) {
  return `${monthKey}|${buildRecurringSignature(type, value, description)}`;
}

export function buildRecurringExceptionSignature(templateId: string, occurrenceDate: string) {
  return `${templateId}|${occurrenceDate}`;
}

export function shouldProjectRecurringInMonth(
  templateDate: string,
  selectedYear: number,
  selectedMonth: number,
  frequency?: string | null,
) {
  const template = new Date(`${templateDate}T12:00:00`);
  const templateMonthIndex = template.getFullYear() * 12 + template.getMonth();
  const selectedMonthIndex = selectedYear * 12 + selectedMonth;

  if (selectedMonthIndex < templateMonthIndex) return false;

  if (frequency === 'yearly') {
    return template.getMonth() === selectedMonth;
  }

  return true;
}

type MaterializedRecurringLike = {
  type: string;
  description?: string | null;
  final_category?: string | null;
  wallet_id?: string | null;
  credit_card_id?: string | null;
  payment_method?: string | null;
  project_id?: string | null;
  is_recurring?: boolean;
};

export function buildMaterializedRecurringSignature(item: MaterializedRecurringLike) {
  return [
    item.type,
    normalizeRecurringDescription(item.description),
    item.final_category ?? '',
    item.wallet_id ?? '',
    item.credit_card_id ?? '',
    item.payment_method ?? '',
    item.project_id ?? '',
  ].join('|');
}

export function hideMaterializedRecurringTemplates<T extends MaterializedRecurringLike>(items: T[]) {
  const materializedSignatures = new Set(
    items
      .filter(item => !item.is_recurring)
      .map(item => buildMaterializedRecurringSignature(item))
  );

  return items.filter(item => !(item.is_recurring && materializedSignatures.has(buildMaterializedRecurringSignature(item))));
}