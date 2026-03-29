export const CATEGORIES = [
  { value: 'alimentacao', label: 'Alimentação', variant: 'food' as const },
  { value: 'transporte', label: 'Transporte', variant: 'transport' as const },
  { value: 'lazer', label: 'Lazer', variant: 'leisure' as const },
  { value: 'saude', label: 'Saúde', variant: 'health' as const },
  { value: 'moradia', label: 'Moradia', variant: 'home' as const },
  { value: 'educacao', label: 'Educação', variant: 'education' as const },
  { value: 'outros', label: 'Outros', variant: 'other' as const },
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

export function getCategoryInfo(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Returns the readable label for a category, preserving the original name when it doesn't match any predefined key. */
export function getCategoryLabel(value: string): string {
  const info = getCategoryInfo(value);
  // If fallback to 'Outros' but the original value isn't actually 'outros', use the raw value
  if (info.value === 'outros' && value.toLowerCase() !== 'outros') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return info.label;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pt-BR');
}
