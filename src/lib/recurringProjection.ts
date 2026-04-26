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