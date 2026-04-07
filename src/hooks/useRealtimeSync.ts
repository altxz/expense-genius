import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to Supabase Realtime changes on core tables
 * and invalidates relevant React Query caches so all devices
 * stay in sync automatically.
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
          queryClient.invalidateQueries({ queryKey: ['budget-data'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
          queryClient.invalidateQueries({ queryKey: ['wallets'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_cards' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
          queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['categories'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['budget-data'] });
          queryClient.invalidateQueries({ queryKey: ['budgets'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['debts'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
