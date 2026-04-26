import { describe, expect, it } from 'vitest';
import { hideMaterializedRecurringTemplates } from '@/lib/recurringProjection';

describe('hideMaterializedRecurringTemplates', () => {
  it('hides recurring template when a paid copy exists with same signature on another date', () => {
    const items = [
      {
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
      },
      {
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
        value: 2400,
      },
    ];

    const visible = hideMaterializedRecurringTemplates(items);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('paid-copy');
  });

  it('keeps recurring template visible when no materialized copy exists', () => {
    const items = [
      {
        id: 'template',
        type: 'expense',
        description: 'Aluguel',
        final_category: 'moradia',
        wallet_id: 'wallet-1',
        credit_card_id: null,
        payment_method: 'debit',
        project_id: null,
        is_recurring: true,
      },
    ];

    const visible = hideMaterializedRecurringTemplates(items);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('template');
  });
});
