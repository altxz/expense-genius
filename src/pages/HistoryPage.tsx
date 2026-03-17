import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Search, Download, CheckCircle, AlertTriangle, XCircle, ChevronLeft, ChevronRight, Loader2, BarChart3, TrendingUp, Target } from 'lucide-react';
import { CATEGORIES, getCategoryInfo, formatCurrency, formatDate } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

interface ExpenseWithStatus {
  id: string;
  date: string;
  description: string;
  value: number;
  category_ai: string | null;
  final_category: string;
  created_at: string;
  status: 'correct' | 'corrected' | 'manual';
}

const PAGE_SIZE = 15;

const CHART_COLORS = ['#5447BC', '#4B6DFB', '#DA90FC', '#BEEE62', '#F97316', '#EF4444', '#14B8A6'];

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ period: '3', status: 'all', category: 'all' });
  const [allExpenses, setAllExpenses] = useState<ExpenseWithStatus[]>([]);

  const classifyExpense = (e: { category_ai: string | null; final_category: string }): 'correct' | 'corrected' | 'manual' => {
    if (!e.category_ai) return 'manual';
    return e.category_ai === e.final_category ? 'correct' : 'corrected';
  };

  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch all for analytics
    let allQuery = supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false });
    if (filters.period !== 'all') {
      const months = parseInt(filters.period);
      const from = new Date();
      from.setMonth(from.getMonth() - months);
      allQuery = allQuery.gte('date', from.toISOString().split('T')[0]);
    }
    const { data: allData } = await allQuery;
    const all = (allData || []).map(e => ({ ...e, status: classifyExpense(e) }));
    setAllExpenses(all);

    // Filtered + paginated
    let filtered = all;
    if (filters.status !== 'all') filtered = filtered.filter(e => e.status === filters.status);
    if (filters.category !== 'all') filtered = filtered.filter(e => e.final_category === filters.category);
    if (search.trim()) filtered = filtered.filter(e => e.description.toLowerCase().includes(search.toLowerCase()));

    setTotalCount(filtered.length);
    const start = (page - 1) * PAGE_SIZE;
    setExpenses(filtered.slice(start, start + PAGE_SIZE));
    setLoading(false);
  }, [user, page, filters, search]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    const total = allExpenses.length;
    const withAi = allExpenses.filter(e => e.category_ai);
    const correct = withAi.filter(e => e.status === 'correct').length;
    const corrected = withAi.filter(e => e.status === 'corrected').length;
    const accuracy = withAi.length ? Math.round(correct / withAi.length * 100) : 0;

    // Accuracy by category
    const byCat: Record<string, { correct: number; total: number }> = {};
    withAi.forEach(e => {
      if (!byCat[e.final_category]) byCat[e.final_category] = { correct: 0, total: 0 };
      byCat[e.final_category].total++;
      if (e.status === 'correct') byCat[e.final_category].correct++;
    });
    const accuracyByCategory = Object.entries(byCat).map(([cat, data]) => ({
      name: getCategoryInfo(cat).label,
      accuracy: Math.round(data.correct / data.total * 100),
      total: data.total,
    })).sort((a, b) => a.accuracy - b.accuracy);

    // Top corrections
    const correctionsByCat: Record<string, number> = {};
    allExpenses.filter(e => e.status === 'corrected').forEach(e => {
      correctionsByCat[e.final_category] = (correctionsByCat[e.final_category] || 0) + 1;
    });
    const topCorrections = Object.entries(correctionsByCat)
      .map(([cat, count]) => ({ name: getCategoryInfo(cat).label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { total, accuracy, correct, corrected, manual: total - withAi.length, accuracyByCategory, topCorrections };
  }, [allExpenses]);

  const exportCSV = () => {
    const headers = 'Data,Descrição,Valor,Categoria IA,Categoria Final,Status\n';
    const rows = allExpenses.map(e =>
      `${e.date},"${e.description}",${e.value},${e.category_ai || ''},${e.final_category},${e.status}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'historico-despesas.csv'; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado!', description: 'O arquivo foi baixado com sucesso.' });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const chartConfig = {
    accuracy: { label: 'Precisão', color: 'hsl(var(--ai))' },
    count: { label: 'Correções', color: 'hsl(var(--pink))' },
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground font-medium">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Histórico & Analytics</h1>
                <p className="text-sm text-muted-foreground mt-1">Análise detalhada das categorização e performance da IA</p>
              </div>
              <Button onClick={exportCSV} variant="outline" className="gap-2 rounded-xl">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="rounded-2xl border-0 shadow-md bg-ai text-ai-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ai-foreground/20 flex items-center justify-center"><Target className="h-5 w-5" /></div>
                  <div><p className="text-xs font-medium opacity-80">Precisão IA</p><p className="text-xl font-bold">{analytics.accuracy}%</p></div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-accent text-accent-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-foreground/10 flex items-center justify-center"><CheckCircle className="h-5 w-5" /></div>
                  <div><p className="text-xs font-medium opacity-80">IA Corretas</p><p className="text-xl font-bold">{analytics.correct}</p></div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-pink text-pink-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-foreground/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div>
                  <div><p className="text-xs font-medium opacity-80">Corrigidas</p><p className="text-xl font-bold">{analytics.corrected}</p></div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-0 shadow-md bg-primary text-primary-foreground">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"><BarChart3 className="h-5 w-5" /></div>
                  <div><p className="text-xs font-medium opacity-80">Total</p><p className="text-xl font-bold">{analytics.total}</p></div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Precisão por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.accuracyByCategory.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={analytics.accuracyByCategory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="accuracy" fill="hsl(var(--ai))" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Top Categorias com Correções</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.topCorrections.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={analytics.topCorrections}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--pink))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma correção registrada</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar no histórico..."
                  className="pl-9 rounded-xl h-10"
                />
              </div>
              <Select value={filters.period} onValueChange={v => handleFilterChange('period', v)}>
                <SelectTrigger className="w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mês</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}>
                <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="correct">✅ IA correta</SelectItem>
                  <SelectItem value="corrected">⚠️ Corrigida</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}>
                <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* History Table */}
            <div className="rounded-2xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Descrição</TableHead>
                    <TableHead className="text-right font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Cat. Original (IA)</TableHead>
                    <TableHead className="font-semibold">Cat. Final</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : expenses.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
                  ) : expenses.map(exp => {
                    const origInfo = exp.category_ai ? getCategoryInfo(exp.category_ai) : null;
                    const finalInfo = getCategoryInfo(exp.final_category);
                    return (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium">{formatDate(exp.date)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{exp.description}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(exp.value)}</TableCell>
                        <TableCell>{origInfo ? <Badge variant={origInfo.variant}>{origInfo.label}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell><Badge variant={finalInfo.variant}>{finalInfo.label}</Badge></TableCell>
                        <TableCell className="text-center">
                          {exp.status === 'correct' && (
                            <Tooltip><TooltipTrigger><span className="text-lg">✅</span></TooltipTrigger><TooltipContent>IA categorizou corretamente</TooltipContent></Tooltip>
                          )}
                          {exp.status === 'corrected' && (
                            <Tooltip><TooltipTrigger><span className="text-lg">⚠️</span></TooltipTrigger><TooltipContent>Corrigida pelo usuário</TooltipContent></Tooltip>
                          )}
                          {exp.status === 'manual' && (
                            <Tooltip><TooltipTrigger><span className="text-lg">✏️</span></TooltipTrigger><TooltipContent>Categorizada manualmente</TooltipContent></Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Página {page} de {totalPages} ({totalCount} registros)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
