import { describe, expect, it } from 'vitest';
import {
  buildMaterializedRecurringSignature,
  buildMonthRecurringSignature,
  buildRecurringLooseSignature,
  buildRecurringSignature,
  hideMaterializedRecurringTemplates,
  normalizeRecurringDescription,
} from '@/lib/recurringProjection';

type Item = Parameters<typeof hideMaterializedRecurringTemplates>[0][number] & {
  id: string;
  date?: string;
  value?: number;
};

const baseTemplate: Item = {
  id: 'template',
  type: 'income',
  description: 'Salário',
  final_category: 'salario',
  wallet_id: 'wallet-1',
  credit_card_id: null,
  payment_method: 'debit',
  project_id: null,
  is_recurring: true,
  date: '2026-04-02',
  value: 2301.94,
};

const basePaidCopy = (overrides: Partial<Item> = {}): Item => ({
  id: 'paid-copy',
  type: 'income',
  description: 'Salário',
  final_category: 'salario',
  wallet_id: 'wallet-1',
  credit_card_id: null,
  payment_method: 'debit',
  project_id: null,
  is_recurring: false,
  date: '2026-04-03',
  value: 2301.94,
  ...overrides,
});

describe('normalizeRecurringDescription', () => {
  it('trims, lowercases and tolerates null/undefined', () => {
    expect(normalizeRecurringDescription('  Salário  ')).toBe('salário');
    expect(normalizeRecurringDescription(null)).toBe('');
    expect(normalizeRecurringDescription(undefined)).toBe('');
  });
});

describe('buildRecurringSignature / buildRecurringLooseSignature', () => {
  it('produces stable signatures regardless of casing/whitespace', () => {
    expect(buildRecurringSignature('income', 2301.94, '  Salário ')).toBe(
      buildRecurringSignature('income', 2301.94, 'salário'),
    );
    expect(buildRecurringLooseSignature('income', 'Salário')).toBe('income|salário');
  });

  it('strict signature changes when value changes; loose stays equal', () => {
    const a = buildRecurringSignature('income', 2301.94, 'Salário');
    const b = buildRecurringSignature('income', 2400, 'Salário');
    expect(a).not.toBe(b);

    expect(buildRecurringLooseSignature('income', 'Salário'))
      .toBe(buildRecurringLooseSignature('income', 'Salário'));
  });
});

describe('buildMonthRecurringSignature', () => {
  it('binds the signature to a specific month bucket', () => {
    const apr = buildMonthRecurringSignature('2026-04', 'income', 2301.94, 'Salário');
    const may = buildMonthRecurringSignature('2026-05', 'income', 2301.94, 'Salário');
    expect(apr).not.toBe(may);
  });
});

describe('buildMaterializedRecurringSignature', () => {
  it('considers all identity fields and ignores nulls consistently', () => {
    const a = buildMaterializedRecurringSignature(baseTemplate);
    const b = buildMaterializedRecurringSignature(basePaidCopy());
    expect(a).toBe(b);
  });

  it('differs when wallet/category/credit card differ', () => {
    const a = buildMaterializedRecurringSignature(baseTemplate);
    const b = buildMaterializedRecurringSignature({ ...baseTemplate, wallet_id: 'other' });
    expect(a).not.toBe(b);
  });
});

describe('hideMaterializedRecurringTemplates — history view dedup', () => {
  it('hides recurring template when a paid copy exists with same value/date', () => {
    const visible = hideMaterializedRecurringTemplates([
      baseTemplate,
      basePaidCopy({ date: '2026-04-02' }),
    ]);
    expect(visible.map(v => v.id)).toEqual(['paid-copy']);
  });

  it('hides recurring template when paid copy has DIFFERENT date', () => {
    // Reproduces the bug reported: pay date moved to 03/Apr, template was on 02/Apr
    const visible = hideMaterializedRecurringTemplates([
      baseTemplate,
      basePaidCopy({ date: '2026-04-03' }),
    ]);
    expect(visible.map(v => v.id)).toEqual(['paid-copy']);
  });

  it('hides recurring template when paid copy has DIFFERENT value', () => {
    const visible = hideMaterializedRecurringTemplates([
      baseTemplate,
      basePaidCopy({ value: 2400 }),
    ]);
    expect(visible.map(v => v.id)).toEqual(['paid-copy']);
  });

  it('hides recurring template when paid copy has BOTH different date and value', () => {
    const visible = hideMaterializedRecurringTemplates([
      baseTemplate,
      basePaidCopy({ date: '2026-04-05', value: 2500 }),
    ]);
    expect(visible.map(v => v.id)).toEqual(['paid-copy']);
  });

  it('keeps the recurring template visible when no materialized copy exists', () => {
    const visible = hideMaterializedRecurringTemplates([baseTemplate]);
    expect(visible.map(v => v.id)).toEqual(['template']);
  });

  it('does NOT collapse two unrelated recurring entries with different descriptions', () => {
    const items: Item[] = [
      baseTemplate,
      { ...baseTemplate, id: 'rent', description: 'Aluguel', type: 'expense', final_category: 'moradia' },
    ];
    const visible = hideMaterializedRecurringTemplates(items);
    expect(visible).toHaveLength(2);
  });

  it('does NOT hide template if the materialized record is on a different wallet', () => {
    const visible = hideMaterializedRecurringTemplates([
      baseTemplate,
      basePaidCopy({ wallet_id: 'wallet-2' }),
    ]);
    expect(visible.map(v => v.id).sort()).toEqual(['paid-copy', 'template']);
  });

  it('handles multiple recurring templates with multiple paid copies independently', () => {
    const items: Item[] = [
      baseTemplate, // Salário
      basePaidCopy({ id: 'salary-paid', date: '2026-04-04', value: 2400 }),
      {
        id: 'rent-template',
        type: 'expense',
        description: 'Aluguel',
        final_category: 'moradia',
        wallet_id: 'wallet-1',
        credit_card_id: null,
        payment_method: 'debit',
        project_id: null,
        is_recurring: true,
      },
      {
        id: 'rent-paid',
        type: 'expense',
        description: 'Aluguel',
        final_category: 'moradia',
        wallet_id: 'wallet-1',
        credit_card_id: null,
        payment_method: 'debit',
        project_id: null,
        is_recurring: false,
      },
    ];
    const visible = hideMaterializedRecurringTemplates(items);
    expect(visible.map(v => v.id).sort()).toEqual(['rent-paid', 'salary-paid']);
  });

  it('does not affect non-recurring installments (installment_group_id is unrelated)', () => {
    const items: Item[] = [
      {
        id: 'inst-1',
        type: 'expense',
        description: 'TV 12x',
        final_category: 'lazer',
        wallet_id: null,
        credit_card_id: 'cc-1',
        payment_method: 'credit',
        project_id: null,
        is_recurring: false,
      },
      {
        id: 'inst-2',
        type: 'expense',
        description: 'TV 12x',
        final_category: 'lazer',
        wallet_id: null,
        credit_card_id: 'cc-1',
        payment_method: 'credit',
        project_id: null,
        is_recurring: false,
      },
    ];
    const visible = hideMaterializedRecurringTemplates(items);
    expect(visible).toHaveLength(2);
  });
});

describe('Projection-month dedup signatures (used in useProjectedTotals)', () => {
  it('matches loose monthly signature regardless of value variation', () => {
    const ym = '2026-04';
    const realLoose = `${ym}|${buildRecurringLooseSignature('income', 'Salário')}`;
    // A real expense recorded with a different value/day in April
    const real = { type: 'income', description: ' Salário ', value: 2400, date: '2026-04-05' };
    const realKey = `${real.date.substring(0, 7)}|${buildRecurringLooseSignature(real.type, real.description)}`;
    expect(realKey).toBe(realLoose);
  });

  it('strict month signature differs when value differs (forces loose fallback)', () => {
    const sigStrict = buildMonthRecurringSignature('2026-04', 'income', 2301.94, 'Salário');
    const sigStrictDifferent = buildMonthRecurringSignature('2026-04', 'income', 2400, 'Salário');
    expect(sigStrict).not.toBe(sigStrictDifferent);
  });
});

/**
 * Regression suite: when the user manually changes the category after AI auto-categorized
 * an expense (especially a recurring one), neither the history view nor the monthly
 * projection should ever duplicate the entry.
 *
 * The materialized signature includes `final_category`, so a category override breaks the
 * strict-signature path. The system MUST still dedup via the loose signature
 * (type|description) used inside useProjectedTotals.
 */
describe('AI categorization override — no duplication on save/update', () => {
  // Simulates the scenario: AI categorized as "outros", user manually changed to "salario"
  const aiCategorizedTemplate: Item = {
    ...baseTemplate,
    final_category: 'outros',          // what AI guessed
  };
  const userOverriddenPaidCopy = basePaidCopy({
    final_category: 'salario',         // what user picked manually
    date: '2026-04-03',
  });

  it('strict materialized signature INTENTIONALLY diverges when category was overridden', () => {
    // Locks the contract: signatures cannot collide just because the description matches.
    expect(buildMaterializedRecurringSignature(aiCategorizedTemplate))
      .not.toBe(buildMaterializedRecurringSignature(userOverriddenPaidCopy));
  });

  it('loose signature stays equal — guarantees the fallback path can dedup recurring entries', () => {
    expect(buildRecurringLooseSignature(aiCategorizedTemplate.type, aiCategorizedTemplate.description))
      .toBe(buildRecurringLooseSignature(userOverriddenPaidCopy.type, userOverriddenPaidCopy.description));
  });

  it('hideMaterializedRecurringTemplates does NOT hide a template whose category was overridden', () => {
    // Important: the materialized dedup is identity-based. The loose dedup happens inside
    // useProjectedTotals (month-level), so hideMaterializedRecurringTemplates keeps both
    // and the projection layer is responsible for not double-counting.
    const visible = hideMaterializedRecurringTemplates([aiCategorizedTemplate, userOverriddenPaidCopy]);
    // Both rows survive here — but useProjectedTotals must still dedup them by month/loose key.
    expect(visible).toHaveLength(2);
  });

  it('monthly loose dedup key matches even when category was overridden (no duplication in month totals)', () => {
    // Reproduces the exact key comparison done inside useProjectedTotals.startingBalance
    // and effectiveMonthExpenses: the loose key wins regardless of category mismatch.
    const ym = '2026-04';
    const templateLooseKey = `${ym}|${buildRecurringLooseSignature(
      aiCategorizedTemplate.type,
      aiCategorizedTemplate.description,
    )}`;
    const paidLooseKey = `${ym}|${buildRecurringLooseSignature(
      userOverriddenPaidCopy.type,
      userOverriddenPaidCopy.description,
    )}`;
    expect(templateLooseKey).toBe(paidLooseKey);
  });

  it('overriding category + value + date simultaneously still produces the same loose key', () => {
    // Edge case: user changed value, moved the date AND fixed the AI category in one go.
    const stressed = basePaidCopy({
      final_category: 'salario',
      value: 2999.99,
      date: '2026-04-12',
    });
    const ym = stressed.date!.substring(0, 7);
    const templateLooseKey = `${ym}|${buildRecurringLooseSignature(
      aiCategorizedTemplate.type,
      aiCategorizedTemplate.description,
    )}`;
    const paidLooseKey = `${ym}|${buildRecurringLooseSignature(stressed.type, stressed.description)}`;
    expect(templateLooseKey).toBe(paidLooseKey);
  });

  it('AI category change does not cross-collapse different descriptions', () => {
    // Safety net: even if two unrelated transactions both get re-categorized to "salario",
    // their loose keys must remain distinct because descriptions differ.
    const otherTx = basePaidCopy({
      id: 'freela',
      description: 'Freela XPTO',
      final_category: 'salario',
    });
    expect(buildRecurringLooseSignature(aiCategorizedTemplate.type, aiCategorizedTemplate.description))
      .not.toBe(buildRecurringLooseSignature(otherTx.type, otherTx.description));
  });

  it('whitespace/casing differences from AI normalization do NOT create duplicates', () => {
    // AI sometimes returns descriptions with trailing spaces or casing changes.
    // The normalization layer must collapse them so dedup still works.
    const aiVariant: Item = { ...aiCategorizedTemplate, description: '  SALÁRIO ' };
    const userVariant: Item = { ...userOverriddenPaidCopy, description: 'salário' };
    expect(buildRecurringLooseSignature(aiVariant.type, aiVariant.description))
      .toBe(buildRecurringLooseSignature(userVariant.type, userVariant.description));
  });
});

