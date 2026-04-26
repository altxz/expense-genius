import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to Supabase Realtime changes on core tables
 * and invalidates relevant React Query caches so all devices
 * stay in sync automatically.
 *
 * Also forces a full refetch when the app regains focus or
 * reconnects to the internet — this handles cases where the
 * Realtime WebSocket dropped (PWA in background, mobile screen off).
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['projected-totals'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['budget-data'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    };

    const channel = supabase
      .channel(`global-sync-${user.id}`)
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

    // Quando a aba/PWA volta a ficar visível (depois de minimizado),
    // o WebSocket pode estar zumbi — forçamos refetch e religamos canal.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        invalidateAll();
      }
    };

    // Quando a internet volta, refetch.
    const handleOnline = () => {
      invalidateAll();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
