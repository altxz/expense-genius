import { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonthSelector } from '@/components/MonthSelector';
import {
  ArrowLeft,
  Loader2,
  Tag,
  TrendingDown,
  TrendingUp,
  ArrowDownUp,
  Pencil,
} from 'lucide-react';
import { icons } from 'lucide-react';
import { formatCurrency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EditExpenseModal } from '@/components/EditExpenseModal';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
}

interface Expense {
  id: string;
  description: string;
  date: string;
  value: number;
  type: 'expense' | 'income' | 'transfer';
  final_category: string;
  is_paid: boolean;
  credit_card_id: string | null;
}

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascalName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const IconComp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[pascalName];
  if (!IconComp) return <Tag className={className} />;
  return <IconComp className={className} />;
}

export default function CategoryDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { startDate, endDate, label } = useSelectedDate();
  const navigate = useNavigate();

  const [category, setCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);

    const { data: cat } = await supabase
      .from('categories')
      .select('id, name, icon, color, parent_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!cat) { setLoading(false); return; }
    setCategory(cat as Category);

    // Fetch subcategories so we can also include their transactions
    const { data: subs } = await supabase
      .from('categories')
      .select('id, name, icon, color, parent_id')
      .eq('user_id', user.id)
      .eq('parent_id', cat.id);
    setSubCategories((subs || []) as Category[]);

    const namesToMatch = [cat.name, ...(subs || []).map(s => s.name)];
    const lowered = namesToMatch.map(n => n.toLowerCase());

    const { data: exps } = await supabase
      .from('expenses')
      .select('id, description, date, value, type, final_category, is_paid, credit_card_id')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lt('date', endDate)
      .in('final_category', Array.from(new Set([...namesToMatch, ...lowered])))
      .order('date', { ascending: false });

    setExpenses((exps || []) as Expense[]);
    setLoading(false);
  }, [user, id, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totals = useMemo(() => {
    let income = 0, expense = 0, count = expenses.length;
    expenses.forEach(e => {
      if (e.type === 'income') income += e.value;
      else if (e.type !== 'transfer') expense += e.value;
    });
    return { income, expense, net: income - expense, count };
  }, [expenses]);

  // Group by sub-category for the breakdown panel
  const breakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      if (e.type === 'transfer') return;
      const key = e.final_category;
      map[key] = (map[key] || 0) + (e.type === 'income' ? e.value : e.value);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/categorias')} className="rounded-xl h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {category ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (category.color || '#6366f1') + '20' }}
                  >
                    <LucideIcon name={category.icon || 'tag'} className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{category.name}</h1>
                    <p className="text-xs text-muted-foreground capitalize">{label}</p>
                  </div>
                </div>
              ) : (
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categoria</h1>
              )}
              <div className="ml-auto">
                <MonthSelector />
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-2xl border-0 shadow-md">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Entradas</p>
                    <p className="text-xl font-bold">{formatCurrency(totals.income)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Saídas</p>
                    <p className="text-xl font-bold">{formatCurrency(totals.expense)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <ArrowDownUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Lançamentos</p>
                    <p className="text-xl font-bold">{totals.count}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown by subcategory (only when there are subs) */}
            {subCategories.length > 0 && breakdown.length > 1 && (
              <Card className="rounded-2xl border-0 shadow-md">
                <CardContent className="p-5 space-y-3">
                  <h2 className="text-sm font-semibold">Distribuição por subcategoria</h2>
                  <div className="space-y-2">
                    {breakdown.map(([name, value]) => {
                      const pct = totals.expense + totals.income > 0
                        ? (value / (totals.expense + totals.income)) * 100
                        : 0;
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium capitalize truncate">{name}</span>
                            <span className="text-muted-foreground">{formatCurrency(value)} · {pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: category?.color || 'hsl(var(--primary))' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transactions list */}
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="p-0">
                <div className="px-5 py-4 border-b">
                  <h2 className="text-sm font-semibold">Lançamentos do período</h2>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    Nenhum lançamento nesta categoria no período selecionado.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {expenses.map(e => {
                      const isIncome = e.type === 'income';
                      const sign = isIncome ? '+' : '-';
                      return (
                        <li key={e.id} className="px-5 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isIncome
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}>
                            {isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{e.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(e.date), "dd 'de' MMM", { locale: ptBR })}
                              </p>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                                {e.final_category}
                              </Badge>
                              {!e.is_paid && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Pendente</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {sign} {formatCurrency(e.value)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl shrink-0"
                            onClick={() => setEditingExpenseId(e.id)}
                            aria-label="Editar lançamento"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {editingExpenseId && (
        <EditExpenseModal
          expenseId={editingExpenseId}
          open={!!editingExpenseId}
          onOpenChange={(o) => !o && setEditingExpenseId(null)}
          onSaved={() => { setEditingExpenseId(null); fetchData(); }}
        />
      )}
    </SidebarProvider>
  );
}
