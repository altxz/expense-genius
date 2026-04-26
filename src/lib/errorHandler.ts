import { toast } from 'sonner';

/**
 * Traduz erros técnicos (Supabase / RLS / rede) em mensagens amigáveis em PT-BR.
 */
export function translateError(err: unknown): { title: string; description: string; isAuthIssue: boolean } {
  const raw = (err as any)?.message || String(err || '');
  const code = (err as any)?.code || '';
  const lower = raw.toLowerCase();

  // RLS / permissão
  if (lower.includes('row-level security') || lower.includes('row level security') || code === '42501') {
    return {
      title: 'Sessão expirada',
      description: 'Sua sessão pode ter expirado ou há um problema de sincronização. Recarregue para continuar.',
      isAuthIssue: true,
    };
  }

  // JWT / Auth
  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('invalid token') || code === 'PGRST301') {
    return {
      title: 'Não autenticado',
      description: 'Sua sessão expirou. Recarregue a página para entrar novamente.',
      isAuthIssue: true,
    };
  }

  // Rede / sincronização
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed') || lower.includes('timeout')) {
    return {
      title: 'Falha de conexão',
      description: 'Não foi possível sincronizar com o servidor. Verifique sua internet e recarregue.',
      isAuthIssue: false,
    };
  }

  // Conflito / duplicado
  if (code === '23505' || lower.includes('duplicate key')) {
    return {
      title: 'Registro duplicado',
      description: 'Este item já existe. Recarregue para ver os dados atualizados.',
      isAuthIssue: false,
    };
  }

  return {
    title: 'Algo deu errado',
    description: raw || 'Ocorreu um erro inesperado. Tente recarregar a página.',
    isAuthIssue: false,
  };
}

/**
 * Mostra um toast de erro amigável em PT-BR com botão de recarregar.
 */
export function showFriendlyError(err: unknown, fallbackTitle?: string) {
  const { title, description } = translateError(err);
  toast.error(fallbackTitle || title, {
    description,
    duration: 8000,
    action: {
      label: 'Recarregar',
      onClick: () => window.location.reload(),
    },
  });
}
