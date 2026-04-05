import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, CreditCard, PiggyBank, BarChart3, Bell, BellRing, Shield,
  Calculator, Activity, Brain, Upload, Wallet, Calendar, TrendingUp,
  Zap, Target, ArrowLeftRight, FolderKanban, Smartphone, Globe,
  LayoutDashboard, Bot, Flame, Snowflake, Gauge, TreeDeciduous,
  Repeat, SplitSquareHorizontal, FileText, Lightbulb
} from 'lucide-react';

export interface ChangelogEntry {
  id: string;
  date: string;
  version?: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tag: 'novo' | 'melhoria' | 'correção';
}

// All features implemented so far — add new entries at the TOP
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-04-05-push',
    date: '05/04/2026',
    version: '2.8',
    title: 'Notificações Push (PWA)',
    description: 'Receba lembretes de contas a vencer diretamente no celular. Ative em Configurações → Notificações. Funciona em Android e iOS 16.4+ com o app instalado na tela inicial.',
    icon: <BellRing className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-04-05-score',
    date: '05/04/2026',
    version: '2.7',
    title: 'Score Financeiro Detalhado',
    description: 'Análise completa da sua saúde financeira com 5 dimensões (Poupança, Orçamento, Dívidas, Consistência e Crédito), gráfico Radar, histórico evolutivo e dicas personalizadas para melhorar seu score.',
    icon: <Activity className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-04-05-debt-sim',
    date: '05/04/2026',
    version: '2.6',
    title: 'Simulador de Quitação de Dívidas',
    description: 'Compare os métodos Avalanche (maior juros primeiro) e Bola de Neve (menor saldo primeiro) para eliminar suas dívidas. Inclui gráficos de evolução, timeline de quitação e economia projetada.',
    icon: <Calculator className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-04-04-perf',
    date: '04/04/2026',
    version: '2.5',
    title: 'Otimização de Performance',
    description: 'Carregamento até 3x mais rápido com lazy loading de rotas, code splitting inteligente, cache de dados com React Query e spinner instantâneo na abertura do app.',
    icon: <Zap className="h-5 w-5" />,
    tag: 'melhoria',
  },
  {
    id: '2026-04-03-cc-visual',
    date: '03/04/2026',
    version: '2.4',
    title: 'Visual dos Cartões de Crédito Aprimorado',
    description: 'Cards de resumo de cartão com melhor visibilidade, incluindo "Melhor Dia de Compra" com contraste aprimorado para leitura em ambos os temas.',
    icon: <CreditCard className="h-5 w-5" />,
    tag: 'melhoria',
  },
  {
    id: '2026-03-forecast',
    date: '30/03/2026',
    version: '2.3',
    title: 'Previsão de Fim de Mês e Próximo Mês',
    description: 'O sistema agora projeta o saldo ao final do mês e gera previsões para o mês seguinte considerando assinaturas fixas, parcelas de cartão e média histórica de gastos variáveis.',
    icon: <TrendingUp className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-installments',
    date: '28/03/2026',
    version: '2.2',
    title: 'Motor de Parcelamento Universal',
    description: 'Suporte a parcelamento de até 72x para despesas e receitas. Cada parcela é numerada (ex: 2/10), com avanço automático de data para débito ou mês da fatura para crédito.',
    icon: <Repeat className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-recurring',
    date: '25/03/2026',
    version: '2.1',
    title: 'Despesas e Receitas Recorrentes (Fixas)',
    description: 'Cadastre assinaturas e receitas fixas como templates mensais ou anuais. O sistema projeta automaticamente nas datas futuras sem duplicar registros.',
    icon: <Calendar className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-cc-invoices',
    date: '22/03/2026',
    version: '2.0',
    title: 'Gestão Completa de Faturas de Cartão',
    description: 'Faturas agrupadas por mês de vencimento com fechamento automático, pagamento de fatura com débito em carteira, e distinção visual entre faturas abertas, fechadas e vencidas.',
    icon: <CreditCard className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-import',
    date: '20/03/2026',
    version: '1.9',
    title: 'Importação de CSV e OFX',
    description: 'Importe transações de arquivos CSV e OFX com detecção automática de colunas, pré-visualização em tabela (desktop) ou cards (mobile), e edição em massa antes de salvar.',
    icon: <Upload className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-automation',
    date: '18/03/2026',
    version: '1.8',
    title: 'Regras de Automação',
    description: 'Crie regras para categorizar transações automaticamente com base em padrões de descrição. As regras têm precedência sobre a IA e são aplicadas na criação manual e importação.',
    icon: <Zap className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-chatbot',
    date: '15/03/2026',
    version: '1.7',
    title: 'Chatbot Genius com IA',
    description: 'Assistente financeiro inteligente que responde perguntas sobre suas finanças, analisa padrões de gastos e oferece sugestões personalizadas com base nos seus dados.',
    icon: <Bot className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-ai-cat',
    date: '12/03/2026',
    version: '1.6',
    title: 'Categorização Automática por IA',
    description: 'A IA analisa a descrição das suas transações e sugere categorias automaticamente, aprendendo com suas correções para melhorar ao longo do tempo.',
    icon: <Brain className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-analytics',
    date: '10/03/2026',
    version: '1.5',
    title: 'Painel de Análises Avançadas',
    description: 'Dashboard com 16+ gráficos: Mapa de Calor, Cascata, Burndown, Treemap de subcategorias, Donut de categorias, Fixo vs Variável, Comparativo semanal, Taxa de Poupança e mais.',
    icon: <BarChart3 className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-wealth',
    date: '08/03/2026',
    version: '1.4',
    title: 'Gestão Patrimonial Multi-Moeda',
    description: 'Acompanhe contas correntes, poupança, ações e criptomoedas em BRL, USD, EUR e BTC. Conversão automática para BRL com taxas em tempo real via AwesomeAPI e CoinGecko.',
    icon: <Globe className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-networth',
    date: '05/03/2026',
    version: '1.3',
    title: 'Patrimônio Líquido e Sobrevivência Financeira',
    description: 'Rastreamento do patrimônio líquido com histórico evolutivo e indicador de "Runway" que estima quantos meses suas reservas cobrem as despesas médias.',
    icon: <Shield className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-budget',
    date: '03/03/2026',
    version: '1.2',
    title: 'Módulo de Orçamento',
    description: 'Defina limites de gastos por categoria com acompanhamento visual em barras de progresso. Alertas automáticos quando atingir 80% do limite definido.',
    icon: <PiggyBank className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-03-projects',
    date: '01/03/2026',
    version: '1.1',
    title: 'Projetos Financeiros',
    description: 'Organize despesas por projetos (viagem, reforma, evento) com orçamento dedicado e acompanhamento de gastos por projeto.',
    icon: <FolderKanban className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-02-pwa',
    date: '28/02/2026',
    version: '1.0',
    title: 'App Instalável (PWA)',
    description: 'Instale a Lumnia na tela inicial do seu celular como um app nativo. Funciona offline com cache inteligente e carregamento rápido.',
    icon: <Smartphone className="h-5 w-5" />,
    tag: 'novo',
  },
  {
    id: '2026-02-core',
    date: '25/02/2026',
    version: '0.9',
    title: 'Plataforma Base — Dashboard e Transações',
    description: 'Cadastro de receitas, despesas e transferências com categorias customizáveis, filtros por período, carteiras múltiplas e resumo financeiro com cards interativos.',
    icon: <LayoutDashboard className="h-5 w-5" />,
    tag: 'novo',
  },
];

// Latest changelog ID — update this when adding new entries
export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? '';

const tagColors: Record<string, string> = {
  novo: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  melhoria: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'correção': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

const tagLabels: Record<string, string> = {
  novo: 'Novo',
  melhoria: 'Melhoria',
  'correção': 'Correção',
};

export default function ChangelogPage() {
  const { user, loading: authLoading } = useAuth();

  // Mark as read on mount
  useEffect(() => {
    if (LATEST_CHANGELOG_ID) {
      localStorage.setItem('lumnia_changelog_read', LATEST_CHANGELOG_ID);
      // Dispatch event so sidebar badge updates immediately
      window.dispatchEvent(new Event('changelog-read'));
    }
  }, []);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Novidades
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe todas as funcionalidades e melhorias da plataforma
              </p>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border hidden sm:block" />

              <div className="space-y-4">
                {CHANGELOG.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4 relative">
                    {/* Timeline dot */}
                    <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/30 items-center justify-center z-10 text-primary">
                      {entry.icon}
                    </div>

                    <Card className="flex-1 hover:shadow-md transition-shadow">
                      <CardContent className="py-4 px-4 sm:px-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="sm:hidden text-primary">{entry.icon}</span>
                            <h3 className="text-sm sm:text-base font-semibold text-foreground">{entry.title}</h3>
                            <Badge variant="outline" className={`text-[10px] ${tagColors[entry.tag]}`}>
                              {tagLabels[entry.tag]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {entry.version && (
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                v{entry.version}
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground tabular-nums">{entry.date}</span>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          {entry.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
